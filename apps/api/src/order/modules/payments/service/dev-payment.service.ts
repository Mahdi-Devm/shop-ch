import { ApiException } from '@common/exceptions/api.exception';
import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type { PaymentPayload } from '@common/messaging/contracts/payment-events';
import {
  PAYMENT_EVENTS_EXCHANGE,
  PAYMENT_EVENT_ROUTING_KEYS,
  PaymentEventType,
} from '@common/messaging/contracts/payment-events';
import { appendToOutbox } from '@common/messaging/outbox/outbox.writer';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderEnvironment } from '@order/config/order-environment';
import { OrderStatus } from '@order/modules/orders/entities/order.entity';
import { OrdersRepository } from '@order/modules/orders/repository/orders.repository';
import { DataSource } from 'typeorm';
import type {
  PaymentOutcome,
  SimulatedPaymentResponse,
} from '../dto/simulate-payment.dto';

@Injectable()
export class DevPaymentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersRepository: OrdersRepository,
    private readonly configService: ConfigService<OrderEnvironment, true>,
  ) {}

  async simulate(
    orderId: string,
    userId: string,
    outcome: PaymentOutcome,
  ): Promise<SimulatedPaymentResponse> {
    if (!this.configService.get('ENABLE_DEV_PAYMENT', { infer: true })) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }

    const order = await this.ordersRepository.findOwnedBy(orderId, userId);
    if (!order) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    }
    if (order.status !== OrderStatus.Reserved) {
      throw new ApiException(HttpStatus.CONFLICT, 'ORDER_NOT_RESERVED', {
        status: order.status,
      });
    }

    const type =
      outcome === 'succeeded'
        ? PaymentEventType.Succeeded
        : PaymentEventType.Failed;
    const payload: PaymentPayload = { orderId };

    await appendToOutbox(this.dataSource.manager, {
      exchange: PAYMENT_EVENTS_EXCHANGE,
      routingKey: PAYMENT_EVENT_ROUTING_KEYS[type],
      event: createIntegrationEvent({
        aggregateId: orderId,
        version: order.version,
        type,
        payload,
      }),
    });

    return { orderId, outcome };
  }
}
