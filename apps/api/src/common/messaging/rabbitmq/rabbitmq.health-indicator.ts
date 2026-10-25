import type { HealthIndicator } from '@common/health/health-indicator';
import { RabbitMqConnection } from '@common/messaging/rabbitmq/rabbitmq.connection';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RabbitMqHealthIndicator implements HealthIndicator {
  readonly name = 'rabbitmq';

  constructor(private readonly connection: RabbitMqConnection) {}

  check(): Promise<void> {
    if (!this.connection.isConnected()) {
      return Promise.reject(new Error('Broker is not connected'));
    }
    return Promise.resolve();
  }
}
