import { isStockCommand } from '@common/messaging/contracts/stock-events';
import {
  NonRetryableMessageError,
  RabbitMqConsumer,
} from '@common/messaging/rabbitmq/rabbitmq.consumer';
import { STOCK_COMMANDS_QUEUE } from '@inventory/messaging/inventory-topology';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { StockReservationService } from '../service/stock-reservation.service';

@Injectable()
export class StockCommandsConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly stockReservationService: StockReservationService,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.consume(STOCK_COMMANDS_QUEUE, async (event) => {
      if (!isStockCommand(event)) {
        throw new NonRetryableMessageError(
          `Unsupported stock command ${event.type}`,
        );
      }
      await this.stockReservationService.handle(event);
    });
  }
}
