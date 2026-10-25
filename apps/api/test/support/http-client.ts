import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

export const FLASH_SALE_PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

export function server(app: NestExpressApplication): App {
  return app.getHttpServer();
}

export function uniqueIp(): string {
  const bytes = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  return `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`;
}

export function uniqueUser(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export async function login(
  app: NestExpressApplication,
  username: string,
): Promise<string> {
  const response = await request(server(app))
    .post('/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({ username, password: 'any' })
    .expect(200);
  return (response.body as { access_token: string }).access_token;
}

export function placeOrder(
  app: NestExpressApplication,
  token: string,
  idempotencyKey: string = randomUUID(),
  body: object = { productId: FLASH_SALE_PRODUCT_ID, quantity: 1 },
): request.Test {
  return request(server(app))
    .post('/api/orders')
    .set('X-Forwarded-For', uniqueIp())
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', idempotencyKey)
    .send(body);
}

export type OrderBody = {
  orderId: string;
  status: string;
  version: number;
};

export async function getOrder(
  app: NestExpressApplication,
  token: string,
  orderId: string,
): Promise<OrderBody> {
  const response = await request(server(app))
    .get(`/api/orders/${orderId}`)
    .set('X-Forwarded-For', uniqueIp())
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return response.body as OrderBody;
}

export function simulatePayment(
  app: NestExpressApplication,
  token: string,
  orderId: string,
  outcome: 'succeeded' | 'failed',
): request.Test {
  return request(server(app))
    .post(`/api/dev/orders/${orderId}/payment`)
    .set('X-Forwarded-For', uniqueIp())
    .set('Authorization', `Bearer ${token}`)
    .send({ outcome });
}
