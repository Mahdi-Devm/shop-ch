import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import {
  ORDER_EVENTS_EXCHANGE,
  StockCommandType,
} from '@common/messaging/contracts/stock-events';
import { RabbitMqPublisher } from '@common/messaging/rabbitmq/rabbitmq.publisher';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DataSource } from 'typeorm';
import { TestBroker } from './support/broker';
import {
  connectInventoryDatabase,
  connectOrderDatabase,
  countRows,
  orderStatus,
  resetOrderDatabase,
  setFlashSaleStock,
} from './support/databases';
import {
  FLASH_SALE_PRODUCT_ID,
  login,
  placeOrder,
  uniqueUser,
} from './support/http-client';
import { createInventoryApp, createOrderApp } from './support/service-apps';
import { waitFor } from './support/wait-for';

type OutboxRow = {
  published_at: Date | null;
  attempts: number;
};

describe('Outbox recovery (e2e)', () => {
  let inventoryApp: NestExpressApplication;
  let orderDatabase: DataSource;
  let inventoryDatabase: DataSource;
  let broker: TestBroker;

  beforeAll(async () => {
    inventoryApp = await createInventoryApp();
    orderDatabase = await connectOrderDatabase();
    inventoryDatabase = await connectInventoryDatabase();
    broker = await TestBroker.connect();
  });

  afterAll(async () => {
    await broker.close();
    await orderDatabase.destroy();
    await inventoryDatabase.destroy();
    await inventoryApp.close();
  });

  beforeEach(async () => {
    await resetOrderDatabase(orderDatabase);
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      500,
    );
  });

  async function outboxRowFor(orderId: string): Promise<OutboxRow> {
    const rows: OutboxRow[] = await orderDatabase.query(
      'SELECT published_at, attempts FROM outbox_events WHERE aggregate_id = $1 AND type = $2',
      [orderId, StockCommandType.ReservationRequested],
    );
    const [row] = rows;
    if (!row) {
      throw new Error(`No outbox row for order ${orderId}`);
    }
    return row;
  }

  it('publishes and processes an event that was committed but never published before a crash', async () => {
    const crashingReplica = await createOrderApp();
    jest
      .spyOn(crashingReplica.get(RabbitMqPublisher), 'publish')
      .mockRejectedValue(new Error('broker unreachable'));

    const userId = uniqueUser('crash');
    const token = await login(crashingReplica, userId);
    const created = await placeOrder(crashingReplica, token).expect(201);
    const { orderId } = created.body as { orderId: string };

    await waitFor(
      async () => (await outboxRowFor(orderId)).attempts >= 2,
      'the relay to fail publishing at least twice',
    );
    expect((await outboxRowFor(orderId)).published_at).toBeNull();
    expect(await orderStatus(orderDatabase, orderId)).toBe('Pending');

    await crashingReplica.close();
    const restartedReplica = await createOrderApp();

    try {
      await waitFor(
        async () => (await orderStatus(orderDatabase, orderId)) === 'Reserved',
        'the recovered order to be reserved by inventory',
      );
      expect((await outboxRowFor(orderId)).published_at).not.toBeNull();
      expect(
        await countRows(
          inventoryDatabase,
          'SELECT count(*) FROM reservations WHERE order_id = $1',
          [orderId],
        ),
      ).toBe(1);
    } finally {
      await restartedReplica.close();
    }
  });

  it('never publishes the same outbox row twice from competing replicas', async () => {
    const replicas = [
      await createOrderApp(),
      await createOrderApp(),
      await createOrderApp(),
    ];
    const published: IntegrationEvent[] = await broker.captureEvents(
      ORDER_EVENTS_EXCHANGE,
      'stock.reservation-requested',
    );

    try {
      const tokens = await Promise.all(
        Array.from({ length: 60 }, (_, index) =>
          login(replicas[index % 3], uniqueUser('relay')),
        ),
      );
      await Promise.all(
        tokens.map((token, index) =>
          placeOrder(replicas[index % 3], token).expect(201),
        ),
      );

      await waitFor(
        async () =>
          (await countRows(
            orderDatabase,
            'SELECT count(*) FROM outbox_events WHERE published_at IS NULL',
          )) === 0 && published.length >= 60,
        'all outbox rows to be published',
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      const eventIds = published.map((event) => event.eventId);
      expect(eventIds).toHaveLength(60);
      expect(new Set(eventIds).size).toBe(60);
    } finally {
      await Promise.all(replicas.map((replica) => replica.close()));
    }
  });
});
