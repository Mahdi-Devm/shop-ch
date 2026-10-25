import { Module } from '@nestjs/common';
import { ProductsModule } from '@order/modules/products/products.module';
import { OrderEventsConsumers } from './controller/order-events.consumers';
import { OrdersController } from './controller/orders.controller';
import { IdempotencyKeysRepository } from './repository/idempotency-keys.repository';
import { OrdersRepository } from './repository/orders.repository';
import { IdempotencyKeyCleanupService } from './service/idempotency-key-cleanup.service';
import { OrderLifecycleService } from './service/order-lifecycle.service';
import { OrderPlacementService } from './service/order-placement.service';
import { OrderStatusFeedService } from './service/order-status-feed.service';
import { OrderStatusStream } from './service/order-status-stream.service';

@Module({
  imports: [ProductsModule],
  controllers: [OrdersController],
  providers: [
    OrdersRepository,
    IdempotencyKeysRepository,
    OrderPlacementService,
    OrderLifecycleService,
    OrderStatusStream,
    OrderStatusFeedService,
    OrderEventsConsumers,
    IdempotencyKeyCleanupService,
  ],
  exports: [OrdersRepository],
})
export class OrdersModule {}
