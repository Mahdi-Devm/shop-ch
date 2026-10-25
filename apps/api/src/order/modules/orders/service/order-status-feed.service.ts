import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { OrderStatusEvent } from '../dto/order.responses';
import { TERMINAL_ORDER_STATUSES } from '../entities/order.entity';
import { OrderPlacementService } from './order-placement.service';
import { OrderStatusStream } from './order-status-stream.service';

const HEARTBEAT_INTERVAL_MS = 15_000;

@Injectable()
export class OrderStatusFeedService {
  constructor(
    private readonly orderPlacementService: OrderPlacementService,
    private readonly statusStream: OrderStatusStream,
  ) {}

  async open(
    orderId: string,
    userId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.orderPlacementService.getOrder(orderId, userId);

    return new Observable<MessageEvent>((subscriber) => {
      let lastVersion = 0;
      const emit = (event: OrderStatusEvent): void => {
        if (event.version <= lastVersion) {
          return;
        }
        lastVersion = event.version;
        subscriber.next({ data: event });
        if (TERMINAL_ORDER_STATUSES.includes(event.status)) {
          subscriber.complete();
        }
      };

      const unsubscribe = this.statusStream.subscribe(orderId, (update) =>
        emit({ status: update.status, version: update.version }),
      );
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'heartbeat', data: '' }),
        HEARTBEAT_INTERVAL_MS,
      );

      this.orderPlacementService
        .getOrder(orderId, userId)
        .then((order) => emit({ status: order.status, version: order.version }))
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
    });
  }
}
