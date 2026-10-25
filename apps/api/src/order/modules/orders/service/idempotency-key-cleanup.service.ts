import type {
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { IdempotencyKeysRepository } from '../repository/idempotency-keys.repository';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class IdempotencyKeyCleanupService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(IdempotencyKeyCleanupService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly idempotencyKeysRepository: IdempotencyKeysRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.removeExpiredKeys(),
      CLEANUP_INTERVAL_MS,
    );
    this.timer.unref();
  }

  beforeApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async removeExpiredKeys(): Promise<number> {
    try {
      const removed = await this.idempotencyKeysRepository.deleteExpired(
        new Date(),
      );
      if (removed > 0) {
        this.logger.log(`Removed ${removed} expired idempotency key(s)`);
      }
      return removed;
    } catch (error: unknown) {
      this.logger.warn(
        `Idempotency key cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return 0;
    }
  }
}
