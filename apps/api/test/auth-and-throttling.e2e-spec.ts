import { AllowQueryToken, CurrentUser } from '@common/auth/auth.decorators';
import type { AuthenticatedUser } from '@common/auth/authenticated-user';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createOrderApp } from './support/service-apps';

@Controller('api/probe')
class ProbeController {
  @Get()
  whoAmI(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @AllowQueryToken()
  @Get('stream')
  stream(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(header: object, payload: object, secret: string): string {
  const unsigned = `${base64Url(header)}.${base64Url(payload)}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

function uniqueIp(): string {
  const bytes = randomUUID().replace(/-/g, '').slice(0, 6);
  return `10.${parseInt(bytes.slice(0, 2), 16)}.${parseInt(bytes.slice(2, 4), 16)}.${parseInt(bytes.slice(4, 6), 16)}`;
}

describe('Authentication and rate limiting (e2e)', () => {
  let replicaA: NestExpressApplication;
  let replicaB: NestExpressApplication;

  beforeAll(async () => {
    replicaA = await createOrderApp([ProbeController]);
    replicaB = await createOrderApp([ProbeController]);
  });

  afterAll(async () => {
    await replicaA.close();
    await replicaB.close();
  });

  function server(app: NestExpressApplication = replicaA): App {
    return app.getHttpServer();
  }

  async function login(username: string, ip = uniqueIp()): Promise<string> {
    const response = await request(server())
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username, password: 'any' })
      .expect(200);
    const body = response.body as { access_token: string; userId: string };
    expect(body.userId).toBe(username);
    return body.access_token;
  }

  describe('POST /auth/login', () => {
    it('issues an HS256 token whose subject is the username', async () => {
      const token = await login('user1');
      const [header, payload] = token.split('.');

      expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual(
        expect.objectContaining({ alg: 'HS256' }),
      );
      expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual(
        expect.objectContaining({ sub: 'user1' }),
      );
    });

    it('rejects a body without a username', async () => {
      const response = await request(server())
        .post('/auth/login')
        .set('X-Forwarded-For', uniqueIp())
        .send({ password: 'any' })
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    });
  });

  describe('JWT guard', () => {
    it('rejects requests without a token', async () => {
      const response = await request(server())
        .get('/api/probe')
        .set('X-Forwarded-For', uniqueIp())
        .expect(401);

      expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
    });

    it('rejects a malformed token', async () => {
      await request(server())
        .get('/api/probe')
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = signToken(
        { alg: 'HS256', typ: 'JWT' },
        { sub: 'user1' },
        'some-other-secret-value',
      );

      await request(server())
        .get('/api/probe')
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('rejects an unsigned token using the none algorithm', async () => {
      const unsigned = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: 'user1' })}.`;

      await request(server())
        .get('/api/probe')
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${unsigned}`)
        .expect(401);
    });

    it('accepts a valid bearer token and exposes the user', async () => {
      const token = await login('alice');
      const response = await request(server())
        .get('/api/probe')
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ userId: 'alice' });
    });

    it('accepts a token from the query string only on routes that allow it', async () => {
      const token = await login('bob');

      await request(server())
        .get('/api/probe')
        .query({ token })
        .set('X-Forwarded-For', uniqueIp())
        .expect(401);

      const response = await request(server())
        .get('/api/probe/stream')
        .query({ token })
        .set('X-Forwarded-For', uniqueIp())
        .expect(200);

      expect(response.body).toEqual({ userId: 'bob' });
    });

    it('leaves the health endpoint public', async () => {
      await request(server()).get('/health').expect(200);
    });
  });

  describe('rate limiting', () => {
    it('limits a single user to 5 requests per second across ips', async () => {
      const token = await login(`limited-${randomUUID()}`);
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await request(server())
          .get('/api/probe')
          .set('X-Forwarded-For', uniqueIp())
          .set('Authorization', `Bearer ${token}`);
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
    });

    it('limits a single ip to 10 requests per second across users', async () => {
      const ip = uniqueIp();
      const tokens = await Promise.all(
        Array.from({ length: 11 }, () => login(`ip-user-${randomUUID()}`)),
      );
      const statuses: number[] = [];

      for (const token of tokens) {
        const response = await request(server())
          .get('/api/probe')
          .set('X-Forwarded-For', ip)
          .set('Authorization', `Bearer ${token}`);
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(
        true,
      );
      expect(statuses[10]).toBe(429);
    });

    it('answers 429 with RATE_LIMITED and a Retry-After header', async () => {
      const ip = uniqueIp();
      let limited: request.Response | undefined;

      for (let attempt = 0; attempt < 11 && !limited; attempt += 1) {
        const response = await request(server())
          .get('/api/probe')
          .set('X-Forwarded-For', ip);
        if (response.status === 429) {
          limited = response;
        }
      }

      expect(limited?.body).toEqual({ code: 'RATE_LIMITED' });
      expect(Number(limited?.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    });

    it('shares counters between replicas through redis', async () => {
      const token = await login(`shared-${randomUUID()}`);
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const replica = attempt % 2 === 0 ? replicaA : replicaB;
        const response = await request(server(replica))
          .get('/api/probe')
          .set('X-Forwarded-For', uniqueIp())
          .set('Authorization', `Bearer ${token}`);
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
    });

    it('lets requests through again after the window passes', async () => {
      const token = await login(`recovering-${randomUUID()}`);
      const send = () =>
        request(server())
          .get('/api/probe')
          .set('X-Forwarded-For', uniqueIp())
          .set('Authorization', `Bearer ${token}`);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await send();
      }
      const limited = await send();
      expect(limited.status).toBe(429);

      const retryAfterSeconds = Number(limited.headers['retry-after']);
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterSeconds * 1000 + 100),
      );

      await send().expect(200);
    });
  });
});
