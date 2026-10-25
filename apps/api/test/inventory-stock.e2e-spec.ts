import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { StockCommandType } from '@common/messaging/contracts/stock-events';
import {
  INVENTORY_EVENTS_EXCHANGE,
  ORDER_EVENTS_EXCHANGE,
  STOCK_COMMAND_ROUTING_KEYS,
  StockCommandType as CommandType,
  StockEventType,
} from '@common/messaging/contracts/stock-events';
import { STOCK_COMMANDS_CONSUMER } from '@inventory/modules/stock/service/stock-reservation.service';
import {
  FLASH_SALE_PRODUCT,
  seedFlashSaleProduct,
} from '@inventory/seed/seed-flash-sale-product';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { TestBroker } from './support/broker';
import {
  connectInventoryDatabase,
  countRows,
  readInventoryProduct,
  resetInventory,
} from './support/databases';
import { createInventoryApp } from './support/service-apps';
import { waitFor } from './support/wait-for';

const PRODUCT_ID = FLASH_SALE_PRODUCT.id;

function stockCommand(
  type: StockCommandType,
  orderId: string,
  productId = PRODUCT_ID,
): IntegrationEvent {
  return createIntegrationEvent({
    aggregateId: orderId,
    version: 1,
    type,
    payload: { orderId, productId, quantity: 1 },
  });
}

describe('Inventory stock reservations (e2e)', () => {
  let replicas: NestExpressApplication[];
  let database: DataSource;
  let broker: TestBroker;

  beforeAll(async () => {
    replicas = [await createInventoryApp(), await createInventoryApp()];
    database = await connectInventoryDatabase();
    broker = await TestBroker.connect();
  });

  afterAll(async () => {
    await broker.close();
    await database.destroy();
    await Promise.all(replicas.map((replica) => replica.close()));
  });

  beforeEach(async () => {
    await resetInventory(database, PRODUCT_ID);
  });

  async function send(command: IntegrationEvent): Promise<void> {
    await broker.publish(
      ORDER_EVENTS_EXCHANGE,
      STOCK_COMMAND_ROUTING_KEYS[command.type as StockCommandType],
      command,
    );
  }

  function processedCount(): Promise<number> {
    return countRows(
      database,
      'SELECT count(*) FROM processed_events WHERE consumer = $1',
      [STOCK_COMMANDS_CONSUMER],
    );
  }

  function outboxCount(type: string): Promise<number> {
    return countRows(
      database,
      'SELECT count(*) FROM outbox_events WHERE type = $1',
      [type],
    );
  }

  async function waitForProcessed(expected: number): Promise<void> {
    await waitFor(
      async () => (await processedCount()) >= expected,
      `${expected} processed stock commands`,
      60_000,
    );
  }

  it('seeds the fixed product with 500 units exactly once', async () => {
    await seedFlashSaleProduct(database.manager);
    await seedFlashSaleProduct(database.manager);

    const products = await countRows(
      database,
      'SELECT count(*) FROM products WHERE id = $1',
      [PRODUCT_ID],
    );
    expect(products).toBe(1);
    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 500, reserved: 0, sold: 0 }),
    );
  });

  it('never reserves more than the initial stock under concurrent commands on two replicas', async () => {
    const commands = Array.from({ length: 600 }, () =>
      stockCommand(CommandType.ReservationRequested, randomUUID()),
    );

    await Promise.all(commands.map((command) => send(command)));
    await waitForProcessed(600);

    const product = await readInventoryProduct(database, PRODUCT_ID);
    expect(product.stock).toBe(0);
    expect(product.reserved).toBe(500);
    expect(product.stock).toBeGreaterThanOrEqual(0);

    expect(await countRows(database, 'SELECT count(*) FROM reservations')).toBe(
      500,
    );
    expect(await outboxCount(StockEventType.Reserved)).toBe(500);
    expect(await outboxCount(StockEventType.ReservationRejected)).toBe(100);
  });

  it('ignores a redelivered command with the same eventId', async () => {
    const command = stockCommand(
      CommandType.ReservationRequested,
      randomUUID(),
    );

    for (let delivery = 0; delivery < 5; delivery += 1) {
      await send(command);
    }
    await waitForProcessed(1);
    await waitFor(
      async () => (await broker.messageCount('inventory.stock-commands')) === 0,
      'the command queue to drain',
    );

    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 499, reserved: 1 }),
    );
    expect(await outboxCount(StockEventType.Reserved)).toBe(1);
  });

  it('does not reserve twice for the same order sent with a new eventId', async () => {
    const orderId = randomUUID();

    await send(stockCommand(CommandType.ReservationRequested, orderId));
    await send(stockCommand(CommandType.ReservationRequested, orderId));
    await waitForProcessed(2);

    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 499, reserved: 1 }),
    );
  });

  it('releases exactly the reserved quantity, and only once', async () => {
    const orderId = randomUUID();

    await send(stockCommand(CommandType.ReservationRequested, orderId));
    await waitForProcessed(1);
    await send(stockCommand(CommandType.ReleaseRequested, orderId));
    await waitForProcessed(2);
    await send(stockCommand(CommandType.ReleaseRequested, orderId));
    await waitForProcessed(3);

    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 500, reserved: 0, sold: 0 }),
    );
    expect(await outboxCount(StockEventType.Released)).toBe(1);
  });

  it('commits a reservation as sold and ignores a release afterwards', async () => {
    const orderId = randomUUID();

    await send(stockCommand(CommandType.ReservationRequested, orderId));
    await waitForProcessed(1);
    await send(stockCommand(CommandType.CommitRequested, orderId));
    await waitForProcessed(2);
    await send(stockCommand(CommandType.ReleaseRequested, orderId));
    await waitForProcessed(3);

    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 499, reserved: 0, sold: 1 }),
    );
    expect(await outboxCount(StockEventType.Committed)).toBe(1);
    expect(await outboxCount(StockEventType.Released)).toBe(0);
  });

  it('rejects a reservation for an unknown product', async () => {
    await send(
      stockCommand(
        CommandType.ReservationRequested,
        randomUUID(),
        randomUUID(),
      ),
    );
    await waitForProcessed(1);

    expect(await outboxCount(StockEventType.ReservationRejected)).toBe(1);
  });

  it('publishes reservation results to the inventory events exchange', async () => {
    const captured = await broker.captureEvents(
      INVENTORY_EVENTS_EXCHANGE,
      'stock.reserved',
    );
    const orderId = randomUUID();

    await send(stockCommand(CommandType.ReservationRequested, orderId));
    await waitFor(
      () => Promise.resolve(captured.length === 1),
      'a StockReserved event on the broker',
    );

    expect(captured[0]).toEqual(
      expect.objectContaining({
        type: StockEventType.Reserved,
        aggregateId: PRODUCT_ID,
        version: 2,
        payload: {
          orderId,
          productId: PRODUCT_ID,
          quantity: 1,
          stock: 499,
          reserved: 1,
        },
      }),
    );
  });

  it('dead-letters a malformed message instead of retrying it forever', async () => {
    await broker.purge('inventory.stock-commands.dlq');

    await broker.publish(
      ORDER_EVENTS_EXCHANGE,
      STOCK_COMMAND_ROUTING_KEYS[CommandType.ReservationRequested],
      '{"not":"an event"}',
    );

    await waitFor(
      async () =>
        (await broker.messageCount('inventory.stock-commands.dlq')) === 1,
      'the malformed message to reach the dead-letter queue',
    );
    expect(await readInventoryProduct(database, PRODUCT_ID)).toEqual(
      expect.objectContaining({ stock: 500 }),
    );
  });
});
