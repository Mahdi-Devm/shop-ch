import { AllowQueryToken, CurrentUser } from '@common/auth/auth.decorators';
import type { AuthenticatedUser } from '@common/auth/authenticated-user';
import type { MessageEvent } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { CreateOrderDto } from '../dto/create-order.dto';
import { IdempotencyKey } from '../dto/idempotency-key.decorator';
import type {
  OrderCreatedResponse,
  OrderResponse,
} from '../dto/order.responses';
import { OrderPlacementService } from '../service/order-placement.service';
import { OrderStatusFeedService } from '../service/order-status-feed.service';

@Controller('api/orders')
export class OrdersController {
  constructor(
    private readonly orderPlacementService: OrderPlacementService,
    private readonly orderStatusFeedService: OrderStatusFeedService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  placeOrder(
    @CurrentUser() user: AuthenticatedUser,
    @IdempotencyKey() idempotencyKey: string,
    @Body() request: CreateOrderDto,
  ): Promise<OrderCreatedResponse> {
    return this.orderPlacementService.placeOrder(
      user.userId,
      idempotencyKey,
      request,
    );
  }

  @Get(':id')
  getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<OrderResponse> {
    return this.orderPlacementService.getOrder(orderId, user.userId);
  }

  @AllowQueryToken()
  @Sse(':id/events')
  streamStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.orderStatusFeedService.open(orderId, user.userId);
  }
}
