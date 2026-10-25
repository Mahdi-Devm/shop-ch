import type { BaseEnvironment } from '@common/config/base-environment';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
  CreateChannelOpts,
} from 'amqp-connection-manager';
import { connect } from 'amqp-connection-manager';

@Injectable()
export class RabbitMqConnection implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('RabbitMQ');
  private manager: AmqpConnectionManager | undefined;

  constructor(
    private readonly configService: ConfigService<BaseEnvironment, true>,
  ) {}

  onModuleInit(): void {
    const manager = connect(
      [this.configService.get('RABBITMQ_URL', { infer: true })],
      { heartbeatIntervalInSeconds: 10, reconnectTimeInSeconds: 2 },
    );

    manager.on('connect', () => this.logger.log('Connected to broker'));
    manager.on('disconnect', ({ err }) =>
      this.logger.warn(
        `Disconnected from broker${err ? `: ${err.message}` : ''}`,
      ),
    );
    manager.on('connectFailed', ({ err }) =>
      this.logger.warn(`Broker connection failed: ${err.message}`),
    );

    this.manager = manager;
  }

  createChannel(options: CreateChannelOpts): ChannelWrapper {
    const channel = this.connectionManager().createChannel(options);
    channel.on('error', (error: unknown) =>
      this.logger.warn(
        `Channel ${options.name ?? 'unnamed'} error: ${error instanceof Error ? error.message : 'unknown error'}`,
      ),
    );
    return channel;
  }

  isConnected(): boolean {
    return this.manager?.isConnected() ?? false;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.manager?.close();
  }

  private connectionManager(): AmqpConnectionManager {
    if (!this.manager) {
      throw new Error('RabbitMQ connection used before module init');
    }
    return this.manager;
  }
}
