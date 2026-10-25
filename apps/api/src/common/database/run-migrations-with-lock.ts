import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import type { DataSourceOptions, EntityManager } from 'typeorm';
import { DataSource } from 'typeorm';

const MIGRATION_LOCK_KEY = 727_001;
const CONNECT_ATTEMPTS = 20;
const CONNECT_RETRY_DELAY_MS = 3000;

async function initializeWithRetry(
  options: DataSourceOptions,
  logger: Logger,
): Promise<DataSource> {
  for (let attempt = 1; ; attempt += 1) {
    const dataSource = new DataSource(options);
    try {
      return await dataSource.initialize();
    } catch (error: unknown) {
      if (attempt >= CONNECT_ATTEMPTS) {
        throw error;
      }
      logger.warn(
        `Database not reachable (attempt ${attempt}/${CONNECT_ATTEMPTS}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await sleep(CONNECT_RETRY_DELAY_MS);
    }
  }
}

export async function runMigrationsWithLock(
  options: DataSourceOptions,
  afterMigrations?: (manager: EntityManager) => Promise<void>,
): Promise<void> {
  const logger = new Logger('Migrations');
  const dataSource = await initializeWithRetry(options, logger);
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.query('SELECT pg_advisory_lock($1)', [
      MIGRATION_LOCK_KEY,
    ]);
    try {
      const executed = await dataSource.runMigrations({ transaction: 'each' });
      logger.log(`Applied ${executed.length} migration(s)`);

      if (afterMigrations) {
        await afterMigrations(dataSource.manager);
      }
    } finally {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        MIGRATION_LOCK_KEY,
      ]);
    }
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}
