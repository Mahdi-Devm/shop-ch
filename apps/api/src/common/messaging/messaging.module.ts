import { OutboxRelay } from '@common/messaging/outbox/outbox.relay';
import { MESSAGING_TOPOLOGY } from '@common/messaging/rabbitmq/messaging.constants';
import type { TopologySetup } from '@common/messaging/rabbitmq/queue-topology';
import { RabbitMqConnection } from '@common/messaging/rabbitmq/rabbitmq.connection';
import { RabbitMqConsumer } from '@common/messaging/rabbitmq/rabbitmq.consumer';
import { RabbitMqHealthIndicator } from '@common/messaging/rabbitmq/rabbitmq.health-indicator';
import { RabbitMqPublisher } from '@common/messaging/rabbitmq/rabbitmq.publisher';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({})
export class MessagingModule {
  static forRoot<TEnvironment extends object>(
    createTopology: (
      configService: ConfigService<TEnvironment, true>,
    ) => TopologySetup,
  ): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      providers: [
        {
          provide: MESSAGING_TOPOLOGY,
          inject: [ConfigService],
          useFactory: createTopology,
        },
        RabbitMqConnection,
        RabbitMqPublisher,
        RabbitMqConsumer,
        RabbitMqHealthIndicator,
        OutboxRelay,
      ],
      exports: [
        RabbitMqConnection,
        RabbitMqPublisher,
        RabbitMqConsumer,
        RabbitMqHealthIndicator,
        OutboxRelay,
      ],
    };
  }
}
