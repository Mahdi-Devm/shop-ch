import { loadEnvironment } from '@common/config/load-environment';
import type { IntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { connect } from 'amqplib';
import { InventoryEnvironment } from '@inventory/config/inventory-environment';

export class TestBroker {
  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: ConfirmChannel,
  ) {}

  static async connect(): Promise<TestBroker> {
    const connection = await connect(
      loadEnvironment(InventoryEnvironment).RABBITMQ_URL,
    );
    const channel = await connection.createConfirmChannel();
    return new TestBroker(connection, channel);
  }

  async publish(
    exchange: string,
    routingKey: string,
    body: IntegrationEvent | string,
  ): Promise<void> {
    const content = Buffer.from(
      typeof body === 'string' ? body : JSON.stringify(body),
    );
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    this.channel.publish(exchange, routingKey, content, { persistent: true });
    await this.channel.waitForConfirms();
  }

  async captureEvents(
    exchange: string,
    routingKey: string,
  ): Promise<IntegrationEvent[]> {
    const captured: IntegrationEvent[] = [];
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    const { queue } = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.consume(
      queue,
      (message) => {
        if (message) {
          captured.push(
            JSON.parse(message.content.toString('utf8')) as IntegrationEvent,
          );
        }
      },
      { noAck: true },
    );
    return captured;
  }

  async messageCount(queue: string): Promise<number> {
    const { messageCount } = await this.channel.checkQueue(queue);
    return messageCount;
  }

  async purge(queue: string): Promise<void> {
    await this.channel.purgeQueue(queue);
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
