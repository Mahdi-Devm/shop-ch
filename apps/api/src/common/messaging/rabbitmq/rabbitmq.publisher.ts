import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import {
  MESSAGING_TOPOLOGY,
  PUBLISH_TIMEOUT_MS,
} from '@common/messaging/rabbitmq/messaging.constants';
import type { TopologySetup } from '@common/messaging/rabbitmq/queue-topology';
import { RabbitMqConnection } from '@common/messaging/rabbitmq/rabbitmq.connection';
import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';

export type OutboundMessage = {
  exchange: string;
  routingKey: string;
  event: IntegrationEvent;
};

@Injectable()
export class RabbitMqPublisher implements OnModuleInit {
  private channel: ChannelWrapper | undefined;

  constructor(
    private readonly connection: RabbitMqConnection,
    @Inject(MESSAGING_TOPOLOGY) private readonly topology: TopologySetup,
  ) {}

  onModuleInit(): void {
    this.channel = this.connection.createChannel({
      name: 'publisher',
      confirm: true,
      publishTimeout: PUBLISH_TIMEOUT_MS,
      setup: (channel: ConfirmChannel) => this.topology(channel),
    });
  }

  async publish(message: OutboundMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Publisher used before module init');
    }

    await this.channel.publish(
      message.exchange,
      message.routingKey,
      Buffer.from(JSON.stringify(message.event)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.event.eventId,
        type: message.event.type,
        timestamp: Math.floor(Date.parse(message.event.occurredAt) / 1000),
      },
    );
  }
}
