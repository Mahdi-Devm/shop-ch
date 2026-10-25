import { SHORT_RESERVATION_TTL_MS } from './support/use-short-reservation-ttl';
import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  RESERVATION_EXPIRY_QUEUE,
  RESERVATION_EXPIRY_SCHEDULED,
} from '@order/messaging/order-topology';
import type { DataSource } from 'typeorm';
import { TestBroker } from './support/broker';
import {
  connectInventoryDatabase,
  connectOrderDatabase,
  orderStatus,
  readInventoryProduct,
  resetOrderDatabase,
  setFlashSaleStock,
} from './support/databases';
import { openEventStream } from './support/event-stream';
import {
  FLASH_SALE_PRODUCT_ID,
  login,
  placeOrder,
  simulatePayment,
  uniqueUser,
} from './support/http-client';
import { createInventoryApp, createOrderApp } from './support/service-apps';
import { waitFor } from './support/wait-for';

const INITIAL_STOCK = 10;

describe('Reservation expiry (e2e)', () => {
  let orderApp: NestExpressApplication;
  let inventoryApp: NestExpressApplication;
  let orderDatabase: DataSource;
  let inventoryDatabase: DataSource;
  let broker: TestBroker;

  beforeAll(async () => {
    inventoryApp = await createInventoryApp();
    orderApp = await createOrderApp();
    orderDatabase = await connectOrderDatabase();
    inventoryDatabase = await connectInventoryDatabase();
    broker = await TestBroker.connect();
  });

  afterAll(async () => {
    await broker.close();
    await orderDatabase.destroy();
    await inventoryDatabase.destroy();
    await orderApp.close();
    await inventoryApp.close();
  });

  beforeEach(async () => {
    await resetOrderDatabase(orderDatabase);
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      INITIAL_STOCK,
    );
  });

  async function reservedOrder(): Promise<{ token: string; orderId: string }> {
    const token = await login(orderApp, uniqueUser('expiring'));
    const created = await placeOrder(orderApp, token).expect(201);
    const { orderId } = created.body as { orderId: string };
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Reserved',
      'the order to be reserved',
    );
    return { token, orderId };
  }

  function inventoryLevels() {
    return readInventoryProduct(inventoryDatabase, FLASH_SALE_PRODUCT_ID);
  }

  async function sendExpiry(orderId: string): Promise<void> {
    await broker.publish(
      '',
      RESERVATION_EXPIRY_QUEUE.name,
      createIntegrationEvent({
        aggregateId: orderId,
        version: 2,
        type: RESERVATION_EXPIRY_SCHEDULED,
        payload: { orderId },
      }),
    );
  }

  it('expires an unpaid reservation and releases exactly its stock', async () => {
    const { token, orderId } = await reservedOrder();
    expect(await inventoryLevels()).toEqual(
      expect.objectContaining({ stock: INITIAL_STOCK - 1, reserved: 1 }),
    );
    const stream = await openEventStream(
      orderApp,
      `/api/orders/${orderId}/events?token=${token}`,
    );

    await stream.ended;
    expect(stream.events[stream.events.length - 1]).toEqual({
      status: 'Expired',
      version: 3,
    });

    await waitFor(
      async () => (await inventoryLevels()).reserved === 0,
      'inventory to release the expired reservation',
    );
    expect(await inventoryLevels()).toEqual(
      expect.objectContaining({ stock: INITIAL_STOCK, reserved: 0, sold: 0 }),
    );
  });

  it('keeps a paid order paid when its expiry fires later', async () => {
    const { token, orderId } = await reservedOrder();

    await simulatePayment(orderApp, token, orderId, 'succeeded').expect(202);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Paid',
      'the order to be paid',
    );
    await new Promise((resolve) =>
      setTimeout(resolve, SHORT_RESERVATION_TTL_MS + 1500),
    );

    expect(await orderStatus(orderDatabase, orderId)).toBe('Paid');
    expect(await inventoryLevels()).toEqual(
      expect.objectContaining({
        stock: INITIAL_STOCK - 1,
        reserved: 0,
        sold: 1,
      }),
    );
  });

  it('ignores duplicate and late expiry messages', async () => {
    const { token, orderId } = await reservedOrder();
    await simulatePayment(orderApp, token, orderId, 'succeeded').expect(202);
    await waitFor(
      async () => (await orderStatus(orderDatabase, orderId)) === 'Paid',
      'the order to be paid',
    );

    await sendExpiry(orderId);
    await sendExpiry(orderId);
    await waitFor(
      async () =>
        (await broker.messageCount(RESERVATION_EXPIRY_QUEUE.name)) === 0,
      'the late expiry messages to be consumed',
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await orderStatus(orderDatabase, orderId)).toBe('Paid');
    expect((await inventoryLevels()).sold).toBe(1);
  });
});
