import { REDIS_CLIENT } from '@common/redis/redis.constants';
import type { RedisEnvironment } from '@common/redis/redis.module';
import { createRedisClient } from '@common/redis/redis.module';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { OrderStatus } from '../entities/order.entity';

export type OrderStatusUpdate = {
  orderId: string;
  status: OrderStatus;
  version: number;
};

type OrderStatusListener = (update: OrderStatusUpdate) => void;

const CHANNEL_PREFIX = 'order-status:';

function parseUpdate(message: string): OrderStatusUpdate | null {
  try {
    const parsed = JSON.parse(message) as Record<string, unknown>;
    const isValid =
      typeof parsed.orderId === 'string' &&
      typeof parsed.version === 'number' &&
      Object.values<unknown>(OrderStatus).includes(parsed.status);
    return isValid ? (parsed as OrderStatusUpdate) : null;
  } catch {
    return null;
  }
}

@Injectable()
export class OrderStatusStream implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrderStatusStream.name);
  private readonly listeners = new Map<string, Set<OrderStatusListener>>();
  private subscriber: Redis | undefined;

  constructor(
    @Inject(REDIS_CLIENT) private readonly publisher: Redis,
    private readonly configService: ConfigService<RedisEnvironment, true>,
  ) {}

  onModuleInit(): void {
    const subscriber = createRedisClient(
      this.configService,
      'order-status-subscriber',
      { enableOfflineQueue: true, maxRetriesPerRequest: null },
    );
    subscriber.on(
      'pmessage',
      (_pattern: string, _channel: string, message: string) =>
        this.dispatch(message),
    );
    subscriber.psubscribe(`${CHANNEL_PREFIX}*`).catch((error: unknown) => {
      this.logger.warn(
        `Could not subscribe to order status updates: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
    this.subscriber = subscriber;
  }

  onApplicationShutdown(): void {
    this.subscriber?.disconnect();
  }

  async publish(update: OrderStatusUpdate): Promise<void> {
    try {
      await this.publisher.publish(
        `${CHANNEL_PREFIX}${update.orderId}`,
        JSON.stringify(update),
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not fan out status of order ${update.orderId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  subscribe(orderId: string, listener: OrderStatusListener): () => void {
    const orderListeners = this.listeners.get(orderId) ?? new Set();
    orderListeners.add(listener);
    this.listeners.set(orderId, orderListeners);

    return () => {
      orderListeners.delete(listener);
      if (orderListeners.size === 0) {
        this.listeners.delete(orderId);
      }
    };
  }

  private dispatch(message: string): void {
    const update = parseUpdate(message);
    if (!update) {
      return;
    }
    for (const listener of this.listeners.get(update.orderId) ?? []) {
      listener(update);
    }
  }
}
