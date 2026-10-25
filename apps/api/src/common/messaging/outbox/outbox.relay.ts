import type { BaseEnvironment } from '@common/config/base-environment';
import { RabbitMqPublisher } from '@common/messaging/rabbitmq/rabbitmq.publisher';
import type {
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';
import { toOutboundMessage } from './outbox.writer';

const RELAY_BATCH_SIZE = 100;
const MAX_ERROR_LENGTH = 500;

@Injectable()
export class OutboxRelay
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;
  private loop: Promise<void> | undefined;
  private wakeUp: (() => void) | undefined;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: RabbitMqPublisher,
    private readonly configService: ConfigService<BaseEnvironment, true>,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    this.loop = this.run();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.running = false;
    this.wakeUp?.();
    await this.loop;
  }

  async relayPendingEvents(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const pending = await manager
        .createQueryBuilder(OutboxEventEntity, 'outbox')
        .where('outbox.publishedAt IS NULL')
        .orderBy('outbox.occurredAt', 'ASC')
        .limit(RELAY_BATCH_SIZE)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (pending.length === 0) {
        return 0;
      }

      const results = await Promise.allSettled(
        pending.map((row) => this.publisher.publish(toOutboundMessage(row))),
      );

      const publishedIds = pending
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((row) => row.eventId);

      if (publishedIds.length > 0) {
        await manager.update(
          OutboxEventEntity,
          { eventId: In(publishedIds) },
          { publishedAt: () => 'now()' },
        );
      }

      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [{ row: pending[index], reason: result.reason as unknown }]
          : [],
      );

      for (const { row, reason } of failures) {
        await manager.update(
          OutboxEventEntity,
          { eventId: row.eventId },
          {
            attempts: () => 'attempts + 1',
            lastError: (reason instanceof Error
              ? reason.message
              : 'unknown error'
            ).slice(0, MAX_ERROR_LENGTH),
          },
        );
      }

      if (failures.length > 0) {
        this.logger.warn(
          `Failed to publish ${failures.length} outbox event(s); they will be retried`,
        );
      }

      return publishedIds.length;
    });
  }

  private async run(): Promise<void> {
    const pollIntervalMs = this.configService.get('OUTBOX_POLL_INTERVAL_MS', {
      infer: true,
    });

    while (this.running) {
      let relayed = 0;
      try {
        relayed = await this.relayPendingEvents();
      } catch (error: unknown) {
        this.logger.warn(
          `Outbox relay iteration failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }

      if (relayed < RELAY_BATCH_SIZE) {
        await this.idle(pollIntervalMs);
      }
    }
  }

  private idle(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, durationMs);
      function done(): void {
        clearTimeout(timer);
        resolve();
      }
      this.wakeUp = done;
    });
  }
}
