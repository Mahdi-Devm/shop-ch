import type { ConfirmChannel } from 'amqplib';

export type QueueBinding = {
  exchange: string;
  routingKey: string;
};

export type ConsumerQueueDefinition = {
  name: string;
  bindings: QueueBinding[];
  prefetch: number;
};

export type TopologySetup = (channel: ConfirmChannel) => Promise<void>;

export function deadLetterQueueName(queue: string): string {
  return `${queue}.dlq`;
}

export function retryQueueName(queue: string, retryDelayMs: number): string {
  return `${queue}.retry.${retryDelayMs}ms`;
}

export function delayQueueName(queue: string, delayMs: number): string {
  return `${queue}.delay.${delayMs}ms`;
}

export async function assertTopicExchange(
  channel: ConfirmChannel,
  exchange: string,
): Promise<void> {
  await channel.assertExchange(exchange, 'topic', { durable: true });
}

export async function assertConsumerQueue(
  channel: ConfirmChannel,
  definition: ConsumerQueueDefinition,
  retryDelayMs: number,
): Promise<void> {
  const deadLetterQueue = deadLetterQueueName(definition.name);

  await channel.assertQueue(deadLetterQueue, { durable: true });
  await channel.assertQueue(definition.name, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: deadLetterQueue,
  });
  await channel.assertQueue(retryQueueName(definition.name, retryDelayMs), {
    durable: true,
    messageTtl: retryDelayMs,
    deadLetterExchange: '',
    deadLetterRoutingKey: definition.name,
  });

  for (const binding of definition.bindings) {
    await assertTopicExchange(channel, binding.exchange);
    await channel.bindQueue(
      definition.name,
      binding.exchange,
      binding.routingKey,
    );
  }
}

export async function assertDelayQueue(
  channel: ConfirmChannel,
  targetQueue: string,
  delayMs: number,
): Promise<string> {
  const name = delayQueueName(targetQueue, delayMs);
  await channel.assertQueue(name, {
    durable: true,
    messageTtl: delayMs,
    deadLetterExchange: '',
    deadLetterRoutingKey: targetQueue,
  });
  return name;
}
