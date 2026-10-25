import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';
import { RedisContainer } from '@testcontainers/redis';
import { writeFileSync } from 'node:fs';
import type { StartedTestContainer } from 'testcontainers';
import { TEST_ENVIRONMENT_FILE } from './test-environment-file';

declare global {
  var e2eContainers: StartedTestContainer[] | undefined;
}

const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'postgres';

function postgres(database: string) {
  return new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase(database)
    .withUsername(DATABASE_USER)
    .withPassword(DATABASE_PASSWORD)
    .start();
}

export default async function globalSetup(): Promise<void> {
  const [orderDatabase, inventoryDatabase, redis, rabbitmq] = await Promise.all(
    [
      postgres('order_db'),
      postgres('inventory_db'),
      new RedisContainer('redis:8-alpine').start(),
      new RabbitMQContainer('rabbitmq:4-management-alpine').start(),
    ],
  );

  globalThis.e2eContainers = [
    orderDatabase,
    inventoryDatabase,
    redis,
    rabbitmq,
  ];

  const environment: Record<string, string> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    JWT_SECRET: 'e2e-test-secret-with-enough-length',
    JWT_EXPIRES_IN_SECONDS: '3600',
    POSTGRES_USER: DATABASE_USER,
    POSTGRES_PASSWORD: DATABASE_PASSWORD,
    POSTGRES_HOST: orderDatabase.getHost(),
    POSTGRES_PORT: String(orderDatabase.getPort()),
    POSTGRES_DB: orderDatabase.getDatabase(),
    INVENTORY_DB_HOST: inventoryDatabase.getHost(),
    INVENTORY_DB_PORT: String(inventoryDatabase.getPort()),
    INVENTORY_DB: inventoryDatabase.getDatabase(),
    REDIS_HOST: redis.getHost(),
    REDIS_PORT: String(redis.getPort()),
    RABBITMQ_URL: rabbitmq.getAmqpUrl(),
    THROTTLE_IP_LIMIT: '10',
    THROTTLE_USER_LIMIT: '5',
    THROTTLE_TTL_MS: '1000',
    OUTBOX_POLL_INTERVAL_MS: '50',
    MESSAGE_RETRY_DELAY_MS: '200',
  };

  writeFileSync(TEST_ENVIRONMENT_FILE, JSON.stringify(environment));
}
