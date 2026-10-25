import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DataSource } from 'typeorm';
import {
  connectInventoryDatabase,
  connectOrderDatabase,
  countOrdersByStatus,
  countRows,
  readInventoryProduct,
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

type BurstResult = {
  statuses: number[];
  codes: string[];
};

describe('Flash sale concurrency (e2e)', () => {
  let orderReplicas: NestExpressApplication[];
  let inventoryReplicas: NestExpressApplication[];
  let orderDatabase: DataSource;
  let inventoryDatabase: DataSource;

  beforeAll(async () => {
    inventoryReplicas = [
      await createInventoryApp(),
      await createInventoryApp(),
    ];
    orderReplicas = [
      await createOrderApp(),
      await createOrderApp(),
      await createOrderApp(),
    ];
    orderDatabase = await connectOrderDatabase();
    inventoryDatabase = await connectInventoryDatabase();
  });

  afterAll(async () => {
    await orderDatabase.destroy();
    await inventoryDatabase.destroy();
    await Promise.all(
      [...orderReplicas, ...inventoryReplicas].map((app) => app.close()),
    );
  });

  beforeEach(async () => {
    await resetOrderDatabase(orderDatabase);
  });

  async function burst(
    replicas: NestExpressApplication[],
    requestCount: number,
  ): Promise<BurstResult> {
    const tokens = await Promise.all(
      Array.from({ length: requestCount }, (_, index) =>
        login(replicas[index % replicas.length], uniqueUser('buyer')),
      ),
    );

    const responses = await Promise.all(
      tokens.map((token, index) =>
        placeOrder(replicas[index % replicas.length], token),
      ),
    );

    return {
      statuses: responses.map((response) => response.status),
      codes: responses.map(
        (response) => (response.body as { code?: string }).code ?? '',
      ),
    };
  }

  async function waitUntilSettled(): Promise<void> {
    await waitFor(
      async () =>
        (await countRows(
          orderDatabase,
          "SELECT count(*) FROM orders WHERE status = 'Pending'",
        )) === 0,
      'every order to leave Pending',
      90_000,
    );
  }

  async function expectNoOverselling(initialStock: number): Promise<void> {
    const statuses = await countOrdersByStatus(orderDatabase);
    const paidOrReserved = (statuses.Paid ?? 0) + (statuses.Reserved ?? 0);
    const product = await readInventoryProduct(
      inventoryDatabase,
      FLASH_SALE_PRODUCT_ID,
    );
    const inventoryReservations = await countRows(
      inventoryDatabase,
      "SELECT count(*) FROM reservations WHERE status IN ('Reserved', 'Committed')",
    );

    expect(product.stock).toBeGreaterThanOrEqual(0);
    expect(paidOrReserved).toBeLessThanOrEqual(initialStock);
    expect(paidOrReserved).toBeLessThanOrEqual(500);
    expect(product.reserved + product.sold).toBe(paidOrReserved);
    expect(inventoryReservations).toBe(paidOrReserved);
    expect(product.stock + product.reserved + product.sold).toBe(initialStock);
  }

  function expectOnlyAcceptedOrSoldOut(result: BurstResult): void {
    result.statuses.forEach((status, index) => {
      if (status !== 201) {
        expect({ status, code: result.codes[index] }).toEqual({
          status: 409,
          code: 'SOLD_OUT',
        });
      }
    });
  }

  it('sells exactly the available units when 50 buyers race for 30', async () => {
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      30,
    );

    const result = await burst([orderReplicas[0]], 50);
    await waitUntilSettled();

    expectOnlyAcceptedOrSoldOut(result);
    await expectNoOverselling(30);
    const statuses = await countOrdersByStatus(orderDatabase);
    expect(statuses.Reserved).toBe(30);
    expect(statuses.Cancelled ?? 0).toBe(
      result.statuses.filter((status) => status === 201).length - 30,
    );
    expect(
      (await readInventoryProduct(inventoryDatabase, FLASH_SALE_PRODUCT_ID))
        .stock,
    ).toBe(0);
  });

  it('never oversells when 200 buyers hit 3 order replicas for 120 units', async () => {
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      120,
    );

    const result = await burst(orderReplicas, 200);
    await waitUntilSettled();

    expectOnlyAcceptedOrSoldOut(result);
    await expectNoOverselling(120);
    expect((await countOrdersByStatus(orderDatabase)).Reserved).toBe(120);
  });

  it('keeps Paid + Reserved within 500 for 200 buyers on 3 replicas with the full stock', async () => {
    await setFlashSaleStock(
      inventoryDatabase,
      orderDatabase,
      FLASH_SALE_PRODUCT_ID,
      500,
    );

    const result = await burst(orderReplicas, 200);
    await waitUntilSettled();

    expect(result.statuses.every((status) => status === 201)).toBe(true);
    await expectNoOverselling(500);
    expect((await countOrdersByStatus(orderDatabase)).Reserved).toBe(200);
  });
});
