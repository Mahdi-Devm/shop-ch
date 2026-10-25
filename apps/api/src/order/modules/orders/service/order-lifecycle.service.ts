import { claimEvent } from '@common/messaging/inbox/claim-event';
import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { PaymentEvent } from '@common/messaging/contracts/payment-events';
import { PaymentEventType } from '@common/messaging/contracts/payment-events';
import type { StockEvent } from '@common/messaging/contracts/stock-events';
import {
  STOCK_EVENTS_QUEUE,
  StockCommandType,
  StockEventType,
} from '@common/messaging/contracts/stock-events';
import { appendToOutbox } from '@common/messaging/outbox/outbox.writer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderEnvironment } from '@order/config/order-environment';
import type { ReservationExpiryScheduled } from '@order/messaging/order-topology';
import {
  PAYMENT_EVENTS_QUEUE,
  RESERVATION_EXPIRY_QUEUE,
  RESERVATION_EXPIRY_SCHEDULED,
  reservationExpiryDelayQueue,
} from '@order/messaging/order-topology';
import { ProductStockRepository } from '@order/modules/products/repository/product-stock.repository';
import { DataSource, EntityManager } from 'typeorm';
import { OrderStatus } from '../entities/order.entity';
import type { OrderTransition } from '../repository/orders.repository';
import { OrdersRepository } from '../repository/orders.repository';
import { appendStockCommand } from './append-stock-command';
import { OrderStatusStream } from './order-status-stream.service';

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersRepository: OrdersRepository,
    private readonly productStockRepository: ProductStockRepository,
    private readonly statusStream: OrderStatusStream,
    private readonly configService: ConfigService<OrderEnvironment, true>,
  ) {}

  handleStockEvent(event: StockEvent): Promise<void> {
    return this.runOnce(
      STOCK_EVENTS_QUEUE.name,
      event.eventId,
      async (manager) => {
        if (event.version > 0) {
          await this.productStockRepository.applyIfNewer(manager, {
            productId: event.payload.productId,
            stock: event.payload.stock,
            reserved: event.payload.reserved,
            version: event.version,
          });
        }

        if (event.type === StockEventType.Reserved) {
          const transition = await this.ordersRepository.transition(
            manager,
            event.payload.orderId,
            [OrderStatus.Pending],
            OrderStatus.Reserved,
          );
          if (transition) {
            await this.scheduleExpiry(manager, transition);
          }
          return transition;
        }

        if (event.type === StockEventType.ReservationRejected) {
          return this.ordersRepository.transition(
            manager,
            event.payload.orderId,
            [OrderStatus.Pending],
            OrderStatus.Cancelled,
          );
        }

        return null;
      },
    );
  }

  handleReservationExpiry(event: ReservationExpiryScheduled): Promise<void> {
    return this.runOnce(
      RESERVATION_EXPIRY_QUEUE.name,
      event.eventId,
      async (manager) => {
        const transition = await this.ordersRepository.transition(
          manager,
          event.payload.orderId,
          [OrderStatus.Reserved],
          OrderStatus.Expired,
        );
        if (transition) {
          await appendStockCommand(
            manager,
            StockCommandType.ReleaseRequested,
            transition,
          );
        }
        return transition;
      },
    );
  }

  handlePayment(event: PaymentEvent): Promise<void> {
    const succeeded = event.type === PaymentEventType.Succeeded;

    return this.runOnce(
      PAYMENT_EVENTS_QUEUE.name,
      event.eventId,
      async (manager) => {
        const transition = await this.ordersRepository.transition(
          manager,
          event.payload.orderId,
          [OrderStatus.Reserved],
          succeeded ? OrderStatus.Paid : OrderStatus.Cancelled,
        );
        if (transition) {
          await appendStockCommand(
            manager,
            succeeded
              ? StockCommandType.CommitRequested
              : StockCommandType.ReleaseRequested,
            transition,
          );
        }
        return transition;
      },
    );
  }

  private async runOnce(
    consumer: string,
    eventId: string,
    apply: (manager: EntityManager) => Promise<OrderTransition | null>,
  ): Promise<void> {
    const transition = await this.dataSource.transaction(async (manager) => {
      const isFirstDelivery = await claimEvent(manager, consumer, eventId);
      return isFirstDelivery ? apply(manager) : null;
    });

    if (transition) {
      await this.statusStream.publish({
        orderId: transition.orderId,
        status: transition.status,
        version: transition.version,
      });
    }
  }

  private async scheduleExpiry(
    manager: EntityManager,
    transition: OrderTransition,
  ): Promise<void> {
    const reservationTtlMs = this.configService.get('RESERVATION_TTL_MS', {
      infer: true,
    });
    const event: ReservationExpiryScheduled = createIntegrationEvent({
      aggregateId: transition.orderId,
      version: transition.version,
      type: RESERVATION_EXPIRY_SCHEDULED,
      payload: { orderId: transition.orderId },
    });

    await appendToOutbox(manager, {
      exchange: '',
      routingKey: reservationExpiryDelayQueue(reservationTtlMs),
      event,
    });
  }
}
