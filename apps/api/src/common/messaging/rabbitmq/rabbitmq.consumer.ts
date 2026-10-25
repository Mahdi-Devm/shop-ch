import type { BaseEnvironment } from '@common/config/base-environment';
import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import {
  InvalidIntegrationEventError,
  parseIntegrationEvent,
} from '@common/messaging/contracts/integration-event';
import { RETRY_COUNT_HEADER } from '@common/messaging/rabbitmq/messaging.constants';
import type { ConsumerQueueDefinition } from '@common/messaging/rabbitmq/queue-topology';
import {
  assertConsumerQueue,
  retryQueueName,
} from '@common/messaging/rabbitmq/queue-topology';
import { RabbitMqConnection } from '@common/messaging/rabbitmq/rabbitmq.connection';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

export type IntegrationEventHandler = (
  event: IntegrationEvent,
) => Promise<void>;

export class NonRetryableMessageError extends Error {}

function retryCountOf(message: ConsumeMessage): number {
  const headers: Record<string, unknown> = message.properties.headers ?? {};
  const count = headers[RETRY_COUNT_HEADER];
  return typeof count === 'number' ? count : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

@Injectable()
export class RabbitMqConsumer implements OnApplicationShutdown {
  private readonly logger = new Logger('RabbitMqConsumer');
  private readonly channels: ChannelWrapper[] = [];

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly configService: ConfigService<BaseEnvironment, true>,
  ) {}

  consume(
    definition: ConsumerQueueDefinition,
    handler: IntegrationEventHandler,
  ): ChannelWrapper {
    const retryDelayMs = this.configService.get('MESSAGE_RETRY_DELAY_MS', {
      infer: true,
    });

    const channel = this.connection.createChannel({
      name: `consumer:${definition.name}`,
      confirm: true,
      setup: async (confirmChannel: ConfirmChannel) => {
        await assertConsumerQueue(confirmChannel, definition, retryDelayMs);
        await confirmChannel.prefetch(definition.prefetch);
        await confirmChannel.consume(
          definition.name,
          (message) => {
            if (message) {
              void this.handle(confirmChannel, definition, message, handler);
            }
          },
          { noAck: false },
        );
      },
    });

    this.channels.push(channel);
    return channel;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.channels.map((channel) => channel.close()));
  }

  private async handle(
    channel: ConfirmChannel,
    definition: ConsumerQueueDefinition,
    message: ConsumeMessage,
    handler: IntegrationEventHandler,
  ): Promise<void> {
    let event: IntegrationEvent;
    try {
      event = parseIntegrationEvent(message.content);
    } catch (error: unknown) {
      this.logger.warn(
        `Dead-lettering malformed message on ${definition.name}: ${errorMessage(error)}`,
      );
      this.settle(() => channel.nack(message, false, false));
      return;
    }

    try {
      await handler(event);
      this.settle(() => channel.ack(message));
    } catch (error: unknown) {
      await this.handleFailure(channel, definition, message, event, error);
    }
  }

  private async handleFailure(
    channel: ConfirmChannel,
    definition: ConsumerQueueDefinition,
    message: ConsumeMessage,
    event: IntegrationEvent,
    error: unknown,
  ): Promise<void> {
    const nonRetryable =
      error instanceof NonRetryableMessageError ||
      error instanceof InvalidIntegrationEventError;
    const attempt = retryCountOf(message) + 1;
    const maxRetries = this.configService.get('MESSAGE_MAX_RETRIES', {
      infer: true,
    });

    if (nonRetryable || attempt > maxRetries) {
      this.logger.error(
        `Dead-lettering ${event.type} ${event.eventId} on ${definition.name} after ${attempt - 1} retries: ${errorMessage(error)}`,
      );
      this.settle(() => channel.nack(message, false, false));
      return;
    }

    this.logger.warn(
      `Retrying ${event.type} ${event.eventId} on ${definition.name} (attempt ${attempt}/${maxRetries}): ${errorMessage(error)}`,
    );

    try {
      const retryDelayMs = this.configService.get('MESSAGE_RETRY_DELAY_MS', {
        infer: true,
      });
      channel.sendToQueue(
        retryQueueName(definition.name, retryDelayMs),
        message.content,
        {
          ...message.properties,
          persistent: true,
          headers: {
            ...(message.properties.headers ?? {}),
            [RETRY_COUNT_HEADER]: attempt,
          },
        },
      );
      await channel.waitForConfirms();
      this.settle(() => channel.ack(message));
    } catch (retryError: unknown) {
      this.logger.warn(
        `Could not schedule retry, requeueing: ${errorMessage(retryError)}`,
      );
      this.settle(() => channel.nack(message, false, true));
    }
  }

  private settle(action: () => void): void {
    try {
      action();
    } catch (error: unknown) {
      this.logger.warn(
        `Could not settle message, broker will redeliver it: ${errorMessage(error)}`,
      );
    }
  }
}
