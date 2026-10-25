import { isPaymentEvent } from '@common/messaging/contracts/payment-events';
import {
  isStockEvent,
  STOCK_EVENTS_QUEUE,
} from '@common/messaging/contracts/stock-events';
import {
  NonRetryableMessageError,
  RabbitMqConsumer,
} from '@common/messaging/rabbitmq/rabbitmq.consumer';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import {
  isReservationExpiryScheduled,
  PAYMENT_EVENTS_QUEUE,
  RESERVATION_EXPIRY_QUEUE,
} from '@order/messaging/order-topology';
import { OrderLifecycleService } from '../service/order-lifecycle.service';

@Injectable()
export class OrderEventsConsumers implements OnApplicationBootstrap {
  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly orderLifecycleService: OrderLifecycleService,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.consume(STOCK_EVENTS_QUEUE, async (event) => {
      if (!isStockEvent(event)) {
        throw new NonRetryableMessageError(
          `Unsupported stock event ${event.type}`,
        );
      }
      await this.orderLifecycleService.handleStockEvent(event);
    });

    this.consumer.consume(RESERVATION_EXPIRY_QUEUE, async (event) => {
      if (!isReservationExpiryScheduled(event)) {
        throw new NonRetryableMessageError(
          `Unsupported expiry message ${event.type}`,
        );
      }
      await this.orderLifecycleService.handleReservationExpiry(event);
    });

    this.consumer.consume(PAYMENT_EVENTS_QUEUE, async (event) => {
      if (!isPaymentEvent(event)) {
        throw new NonRetryableMessageError(
          `Unsupported payment event ${event.type}`,
        );
      }
      await this.orderLifecycleService.handlePayment(event);
    });
  }
}
