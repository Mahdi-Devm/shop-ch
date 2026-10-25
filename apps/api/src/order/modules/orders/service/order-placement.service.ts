import { ApiException } from '@common/exceptions/api.exception';
import { StockCommandType } from '@common/messaging/contracts/stock-events';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderEnvironment } from '@order/config/order-environment';
import { ProductStockRepository } from '@order/modules/products/repository/product-stock.repository';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { CreateOrderDto } from '../dto/create-order.dto';
import type {
  OrderCreatedResponse,
  OrderResponse,
} from '../dto/order.responses';
import { toOrderResponse } from '../dto/order.responses';
import { OrderStatus } from '../entities/order.entity';
import { IdempotencyKeysRepository } from '../repository/idempotency-keys.repository';
import { OrdersRepository } from '../repository/orders.repository';
import { appendStockCommand } from './append-stock-command';

const MILLISECONDS_PER_HOUR = 3_600_000;

function hashRequest(request: CreateOrderDto): string {
  return createHash('sha256')
    .update(JSON.stringify([request.productId, request.quantity]))
    .digest('hex');
}

@Injectable()
export class OrderPlacementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersRepository: OrdersRepository,
    private readonly idempotencyKeysRepository: IdempotencyKeysRepository,
    private readonly productStockRepository: ProductStockRepository,
    private readonly configService: ConfigService<OrderEnvironment, true>,
  ) {}

  placeOrder(
    userId: string,
    idempotencyKey: string,
    request: CreateOrderDto,
  ): Promise<OrderCreatedResponse> {
    return this.dataSource.transaction(async (manager) => {
      const orderId = randomUUID();
      await this.claimIdempotencyKey(
        manager,
        userId,
        idempotencyKey,
        orderId,
        request,
      );

      const product = await this.productStockRepository.find(
        request.productId,
        manager,
      );
      if (!product) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
      }
      if (product.stock < request.quantity) {
        throw new ApiException(HttpStatus.CONFLICT, 'SOLD_OUT');
      }

      const order = {
        id: orderId,
        userId,
        productId: request.productId,
        quantity: request.quantity,
        status: OrderStatus.Pending,
        version: 1,
      };
      await this.ordersRepository.insert(manager, order);
      await appendStockCommand(manager, StockCommandType.ReservationRequested, {
        orderId,
        productId: order.productId,
        quantity: order.quantity,
        version: order.version,
      });

      return { orderId, status: order.status, version: order.version };
    });
  }

  async getOrder(orderId: string, userId: string): Promise<OrderResponse> {
    const order = await this.ordersRepository.findOwnedBy(orderId, userId);
    if (!order) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    }
    return toOrderResponse(order);
  }

  private async claimIdempotencyKey(
    manager: EntityManager,
    userId: string,
    key: string,
    orderId: string,
    request: CreateOrderDto,
  ): Promise<void> {
    const retentionHours = this.configService.get('IDEMPOTENCY_KEY_TTL_HOURS', {
      infer: true,
    });
    const claim = {
      userId,
      key,
      orderId,
      requestHash: hashRequest(request),
      expiresAt: new Date(Date.now() + retentionHours * MILLISECONDS_PER_HOUR),
    };

    if (await this.idempotencyKeysRepository.claim(manager, claim)) {
      return;
    }

    const existing = await this.idempotencyKeysRepository.findForUpdate(
      manager,
      userId,
      key,
    );
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      throw new ApiException(HttpStatus.CONFLICT, 'DUPLICATE_IDEMPOTENCY_KEY', {
        orderId: existing.orderId,
      });
    }

    await this.idempotencyKeysRepository.remove(manager, userId, key);
    if (!(await this.idempotencyKeysRepository.claim(manager, claim))) {
      throw new ApiException(HttpStatus.CONFLICT, 'DUPLICATE_IDEMPOTENCY_KEY');
    }
  }
}
