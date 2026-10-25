import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import {
  INVENTORY_EVENTS_EXCHANGE,
  STOCK_EVENTS_QUEUE,
} from '@common/messaging/contracts/stock-events';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { OrderStatusStream } from '@order/modules/orders/service/order-status-stream.service';
import type { DataSource } from 'typeorm';
import { TestBroker } from './support/broker';
import {
  connectInventoryDatabase,
  connectOrderDatabase,
  countRows,
  orderStatus,
  readInventoryProduct,
  resetOrderDatabase,
  setFlashSaleStock,
} from './support/databases';
import type { StatusEvent } from './support/event-stream';
import { openEventStream } from './support/event-stream';
import {
  FLASH_SALE_PRODUCT_ID,
  getOrder,
  login,
  placeOrder,
  simulatePayment,
  uniqueUser,
} from './support/http-client';
import { createInventoryApp, createOrderApp } from './support/service-apps';
import { waitFor } from './support/wait-for';

function lastEvent(events: StatusEvent[]): StatusEvent | undefined {
  return events[events.length - 1];
}

function expectIncreasingVersions(events: StatusEvent[]): void {
  events.forEach((event, index) => {
    if (index > 0) {
      expect(event.version).toBeGreaterThan(events[index - 1].version);
    }
  });
}

describe('Purchase flow POST /api/orders -> inventory -> SSE (e2e)', () => {
  let replicaA: NestExpressApplication;
  let replicaB: NestExpressApplication;
  let inventoryApp: NestExpressApplication;
  let orderDatabase: DataSource;
  let inventoryDatabase: DataSource;
  let broker: TestBroker;

  beforeAll(async () => {
    inventoryApp = await createInventoryApp();
    replicaA = await createOrderApp();
    replicaB = await createOrderApp();
    orderDatabase = await connectOrderDatabase();
    inventoryDatabase = await connectInventoryDatabase();
    broker = await TestBroker.connect();
  });

  afterAll(async () => {
    await broker.close();
    await orderDatabase.destroy();
    await inventoryDatabase.destroy();
    await Promise.all(
      [replicaA, replicaB, inventoryApp].map((app) => app.close()),
    );
  });

  beforeEach(async () => {
    await resetOrderDatabase(orderDatabase);
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      10,
    );
  });

  async function buy(
    app: NestExpressApplication,
  ): Promise<{ token: string; orderId: string }> {
    const token = await login(app, uniqueUser('flow'));
    const created = await placeOrder(app, token).expect(201);
    return { token, orderId: (created.body as { orderId: string }).orderId };
  }

  it('streams Pending -> Reserved -> Paid live and ends the stream', async () => {
    const { token, orderId } = await buy(replicaA);
    const stream = await openEventStream(
      replicaB,
      `/api/orders/${orderId}/events?token=${token}`,
    );
    expect(stream.statusCode).toBe(200);

    await waitFor(
      () => Promise.resolve(lastEvent(stream.events)?.status === 'Reserved'),
      'a Reserved event on the stream',
    );
    expect(lastEvent(stream.events)).toEqual({
      status: 'Reserved',
      version: 2,
    });

    await simulatePayment(replicaA, token, orderId, 'succeeded').expect(202);
    await stream.ended;

    expect(lastEvent(stream.events)).toEqual({ status: 'Paid', version: 3 });
    expect(stream.events[0].status).toMatch(/^(Pending|Reserved)$/);
    expectIncreasingVersions(stream.events);

    const product = await readInventoryProduct(
      inventoryDatabase,
      FLASH_SALE_PRODUCT_ID,
    );
    await waitFor(
      async () =>
        (await readInventoryProduct(inventoryDatabase, FLASH_SALE_PRODUCT_ID))
          .sold === 1,
      'inventory to commit the paid reservation',
    );
    expect(product.stock).toBe(9);
  });

  it('cancels on a failed payment and releases the stock exactly', async () => {
    const { token, orderId } = await buy(replicaA);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Reserved',
      'the order to be reserved',
    );

    await simulatePayment(replicaA, token, orderId, 'failed').expect(202);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Cancelled',
      'the order to be cancelled',
    );
    await waitFor(
      async () =>
        (await readInventoryProduct(inventoryDatabase, FLASH_SALE_PRODUCT_ID))
          .stock === 10,
      'inventory to release the reservation',
    );

    expect(
      await readInventoryProduct(inventoryDatabase, FLASH_SALE_PRODUCT_ID),
    ).toEqual(expect.objectContaining({ stock: 10, reserved: 0, sold: 0 }));
    await simulatePayment(replicaA, token, orderId, 'succeeded').expect(409);
  });

  it('cancels a pending order that inventory rejects as sold out', async () => {
    await inventoryDatabase.query(
      'UPDATE products SET initial_stock = 0, stock = 0 WHERE id = $1',
      [FLASH_SALE_PRODUCT_ID],
    );
    const { token, orderId } = await buy(replicaA);
    const stream = await openEventStream(
      replicaA,
      `/api/orders/${orderId}/events?token=${token}`,
    );

    await stream.ended;
    expect(lastEvent(stream.events)).toEqual({
      status: 'Cancelled',
      version: 2,
    });
  });

  it('fans out status changes between replicas through redis', async () => {
    const { token, orderId } = await buy(replicaA);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Reserved',
      'the order to be reserved',
    );
    const stream = await openEventStream(
      replicaB,
      `/api/orders/${orderId}/events?token=${token}`,
    );
    await waitFor(
      () => Promise.resolve(stream.events.length === 1),
      'the current state on the stream',
    );

    await replicaA
      .get(OrderStatusStream)
      .publish({ orderId, status: 'Expired', version: 3 });
    await stream.ended;

    expect(stream.events).toEqual([
      { status: 'Reserved', version: 2 },
      { status: 'Expired', version: 3 },
    ]);
  });

  it('accepts a bearer header and rejects strangers and missing tokens', async () => {
    const { orderId } = await buy(replicaA);
    const stranger = await login(replicaA, uniqueUser('stranger'));

    const unauthenticated = await openEventStream(
      replicaA,
      `/api/orders/${orderId}/events`,
    );
    expect(unauthenticated.statusCode).toBe(401);

    const foreign = await openEventStream(
      replicaA,
      `/api/orders/${orderId}/events?token=${stranger}`,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it('ignores a redelivered inventory event on the order side', async () => {
    const captured: IntegrationEvent[] = await broker.captureEvents(
      INVENTORY_EVENTS_EXCHANGE,
      'stock.reserved',
    );
    const { token, orderId } = await buy(replicaA);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Reserved',
      'the order to be reserved',
    );
    const reserved = captured.find(
      (event) => (event.payload as { orderId: string }).orderId === orderId,
    );
    expect(reserved).toBeDefined();

    for (let delivery = 0; delivery < 3; delivery += 1) {
      await broker.publish('', STOCK_EVENTS_QUEUE.name, reserved ?? '');
    }
    await waitFor(
      async () => (await broker.messageCount(STOCK_EVENTS_QUEUE.name)) === 0,
      'the replayed events to be consumed',
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await getOrder(replicaA, token, orderId)).toEqual(
      expect.objectContaining({ status: 'Reserved', version: 2 }),
    );
    expect(
      await countRows(
        orderDatabase,
        "SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND type = 'ReservationExpiryScheduled'",
        [orderId],
      ),
    ).toBe(1);
  });
});
