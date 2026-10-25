import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  connectInventoryDatabase,
  connectOrderDatabase,
  countRows,
  resetOrderDatabase,
  setFlashSaleStock,
} from './support/databases';
import {
  FLASH_SALE_PRODUCT_ID,
  login,
  placeOrder,
  server,
  uniqueIp,
  uniqueUser,
} from './support/http-client';
import { createInventoryApp, createOrderApp } from './support/service-apps';

describe('Orders API (e2e)', () => {
  let orderApp: NestExpressApplication;
  let inventoryApp: NestExpressApplication;
  let orderDatabase: DataSource;
  let inventoryDatabase: DataSource;

  beforeAll(async () => {
    inventoryApp = await createInventoryApp();
    orderApp = await createOrderApp();
    orderDatabase = await connectOrderDatabase();
    inventoryDatabase = await connectInventoryDatabase();
  });

  afterAll(async () => {
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
      500,
    );
  });

  function ordersOf(userId: string): Promise<number> {
    return countRows(
      orderDatabase,
      'SELECT count(*) FROM orders WHERE user_id = $1',
      [userId],
    );
  }

  describe('idempotency', () => {
    it('creates exactly one order when the same key is sent twice', async () => {
      const userId = uniqueUser('retrying');
      const token = await login(orderApp, userId);
      const key = randomUUID();

      const first = await placeOrder(orderApp, token, key).expect(201);
      const second = await placeOrder(orderApp, token, key).expect(409);

      expect(first.body).toEqual({
        orderId: expect.any(String) as string,
        status: 'Pending',
        version: 1,
      });
      expect(second.body).toEqual({
        code: 'DUPLICATE_IDEMPOTENCY_KEY',
        orderId: (first.body as { orderId: string }).orderId,
      });
      expect(await ordersOf(userId)).toBe(1);
    });

    it('creates exactly one order when the same key races in parallel', async () => {
      const userId = uniqueUser('racing');
      const token = await login(orderApp, userId);
      const key = randomUUID();

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => placeOrder(orderApp, token, key)),
      );
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await ordersOf(userId)).toBe(1);
    });

    it('scopes keys per user', async () => {
      const key = randomUUID();
      const alice = await login(orderApp, uniqueUser('alice'));
      const bob = await login(orderApp, uniqueUser('bob'));

      await placeOrder(orderApp, alice, key).expect(201);
      await placeOrder(orderApp, bob, key).expect(201);
    });

    it('accepts a key again once its retention has expired', async () => {
      const userId = uniqueUser('returning');
      const token = await login(orderApp, userId);
      const key = randomUUID();

      await placeOrder(orderApp, token, key).expect(201);
      await orderDatabase.query(
        "UPDATE idempotency_keys SET expires_at = now() - interval '1 second' WHERE user_id = $1",
        [userId],
      );
      await placeOrder(orderApp, token, key).expect(201);

      expect(await ordersOf(userId)).toBe(2);
    });

    it('does not keep the key when the purchase is rejected as sold out', async () => {
      await setFlashSaleStock(
        inventoryDatabase,
        orderDatabase,
        FLASH_SALE_PRODUCT_ID,
        0,
      );
      const token = await login(orderApp, uniqueUser('late'));
      const key = randomUUID();

      const response = await placeOrder(orderApp, token, key).expect(409);
      expect(response.body).toEqual({ code: 'SOLD_OUT' });

      await setFlashSaleStock(
        inventoryDatabase,
        orderDatabase,
        FLASH_SALE_PRODUCT_ID,
        1,
      );
      await placeOrder(orderApp, token, key).expect(201);
    });
  });

  describe('validation', () => {
    let token: string;

    beforeEach(async () => {
      token = await login(orderApp, uniqueUser('validated'));
    });

    it.each([
      [{ productId: FLASH_SALE_PRODUCT_ID, quantity: 2 }],
      [{ productId: FLASH_SALE_PRODUCT_ID, quantity: 0 }],
      [{ productId: FLASH_SALE_PRODUCT_ID, quantity: '1' }],
      [{ productId: FLASH_SALE_PRODUCT_ID }],
      [{ productId: 'not-a-uuid', quantity: 1 }],
      [{ productId: FLASH_SALE_PRODUCT_ID, quantity: 1, price: 0 }],
    ])('rejects body %j with 400', async (body) => {
      const response = await placeOrder(
        orderApp,
        token,
        randomUUID(),
        body,
      ).expect(400);
      expect(response.body).toEqual(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    });

    it('requires an Idempotency-Key header', async () => {
      const response = await request(server(orderApp))
        .post('/api/orders')
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: FLASH_SALE_PRODUCT_ID, quantity: 1 })
        .expect(400);
      expect(response.body).toEqual(
        expect.objectContaining({ code: 'INVALID_IDEMPOTENCY_KEY' }),
      );
    });

    it('rejects an Idempotency-Key that is not a UUID v4', async () => {
      await placeOrder(orderApp, token, 'abc').expect(400);
      await placeOrder(
        orderApp,
        token,
        '11111111-1111-1111-1111-111111111111',
      ).expect(400);
    });

    it('rejects purchases without a valid token', async () => {
      await request(server(orderApp))
        .post('/api/orders')
        .set('X-Forwarded-For', uniqueIp())
        .set('Idempotency-Key', randomUUID())
        .send({ productId: FLASH_SALE_PRODUCT_ID, quantity: 1 })
        .expect(401);
      await placeOrder(orderApp, 'invalid.token.value').expect(401);
    });

    it('answers 404 for an unknown product', async () => {
      const response = await placeOrder(orderApp, token, randomUUID(), {
        productId: randomUUID(),
        quantity: 1,
      }).expect(404);
      expect(response.body).toEqual({ code: 'PRODUCT_NOT_FOUND' });
    });
  });

  describe('reads', () => {
    it('returns the order to its owner only', async () => {
      const owner = await login(orderApp, uniqueUser('owner'));
      const stranger = await login(orderApp, uniqueUser('stranger'));
      const created = await placeOrder(orderApp, owner).expect(201);
      const { orderId } = created.body as { orderId: string };

      const response = await request(server(orderApp))
        .get(`/api/orders/${orderId}`)
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${owner}`)
        .expect(200);
      expect(response.body).toEqual({
        orderId,
        status: expect.any(String) as string,
        version: expect.any(Number) as number,
        productId: FLASH_SALE_PRODUCT_ID,
        quantity: 1,
        createdAt: expect.any(String) as string,
      });

      await request(server(orderApp))
        .get(`/api/orders/${orderId}`)
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${stranger}`)
        .expect(404);
    });

    it('serves product stock from the local read model', async () => {
      const token = await login(orderApp, uniqueUser('browser'));

      const response = await request(server(orderApp))
        .get(`/api/products/${FLASH_SALE_PRODUCT_ID}`)
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: FLASH_SALE_PRODUCT_ID,
        stock: 500,
        reserved: 0,
      });
    });
  });
});
