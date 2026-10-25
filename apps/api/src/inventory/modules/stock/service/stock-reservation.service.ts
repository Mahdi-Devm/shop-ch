import { claimEvent } from '@common/messaging/inbox/claim-event';
import { createIntegrationEvent } from '@common/messaging/contracts/integration-event';
import type {
  StockChangedPayload,
  StockCommand,
  StockCommandPayload,
  StockReservationRejectedPayload,
} from '@common/messaging/contracts/stock-events';
import {
  INVENTORY_EVENTS_EXCHANGE,
  STOCK_EVENT_ROUTING_KEYS,
  StockCommandType,
  StockEventType,
  StockRejectionReason,
} from '@common/messaging/contracts/stock-events';
import { appendToOutbox } from '@common/messaging/outbox/outbox.writer';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ReservationStatus } from '../entities/reservation.entity';
import type { ProductLevels } from '../repository/stock.repository';
import { StockRepository } from '../repository/stock.repository';

export const STOCK_COMMANDS_CONSUMER = 'inventory.stock-commands';

type StockChangeEventType =
  | typeof StockEventType.Reserved
  | typeof StockEventType.Released
  | typeof StockEventType.Committed;

@Injectable()
export class StockReservationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stockRepository: StockRepository,
  ) {}

  async handle(command: StockCommand): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const isFirstDelivery = await claimEvent(
        manager,
        STOCK_COMMANDS_CONSUMER,
        command.eventId,
      );
      if (!isFirstDelivery) {
        return;
      }

      switch (command.type) {
        case StockCommandType.ReservationRequested:
          await this.reserve(manager, command.payload);
          return;
        case StockCommandType.ReleaseRequested:
          await this.release(manager, command.payload);
          return;
        case StockCommandType.CommitRequested:
          await this.commit(manager, command.payload);
          return;
      }
    });
  }

  private async reserve(
    manager: EntityManager,
    request: StockCommandPayload,
  ): Promise<void> {
    const product = await this.stockRepository.lockProduct(
      manager,
      request.productId,
    );
    if (!product) {
      await this.emitRejection(
        manager,
        request,
        StockRejectionReason.ProductNotFound,
        null,
      );
      return;
    }

    const existing = await this.stockRepository.findReservationByOrder(
      manager,
      request.orderId,
    );
    if (existing) {
      return;
    }

    if (product.stock < request.quantity) {
      await this.emitRejection(
        manager,
        request,
        StockRejectionReason.SoldOut,
        product,
      );
      return;
    }

    const updated: ProductLevels = {
      ...product,
      stock: product.stock - request.quantity,
      reserved: product.reserved + request.quantity,
      version: product.version + 1,
    };
    await this.stockRepository.saveLevels(manager, updated);
    await this.stockRepository.createReservation(manager, request);
    await this.emitChange(manager, StockEventType.Reserved, request, updated);
  }

  private async release(
    manager: EntityManager,
    request: StockCommandPayload,
  ): Promise<void> {
    const product = await this.stockRepository.lockProduct(
      manager,
      request.productId,
    );
    const reservation = await this.stockRepository.findReservationByOrder(
      manager,
      request.orderId,
    );
    if (!product || reservation?.status !== ReservationStatus.Reserved) {
      return;
    }

    const updated: ProductLevels = {
      ...product,
      stock: product.stock + reservation.quantity,
      reserved: product.reserved - reservation.quantity,
      version: product.version + 1,
    };
    await this.stockRepository.saveLevels(manager, updated);
    await this.stockRepository.updateReservationStatus(
      manager,
      reservation.id,
      ReservationStatus.Released,
    );
    await this.emitChange(
      manager,
      StockEventType.Released,
      { ...request, quantity: reservation.quantity },
      updated,
    );
  }

  private async commit(
    manager: EntityManager,
    request: StockCommandPayload,
  ): Promise<void> {
    const product = await this.stockRepository.lockProduct(
      manager,
      request.productId,
    );
    const reservation = await this.stockRepository.findReservationByOrder(
      manager,
      request.orderId,
    );
    if (!product || reservation?.status !== ReservationStatus.Reserved) {
      return;
    }

    const updated: ProductLevels = {
      ...product,
      reserved: product.reserved - reservation.quantity,
      sold: product.sold + reservation.quantity,
      version: product.version + 1,
    };
    await this.stockRepository.saveLevels(manager, updated);
    await this.stockRepository.updateReservationStatus(
      manager,
      reservation.id,
      ReservationStatus.Committed,
    );
    await this.emitChange(
      manager,
      StockEventType.Committed,
      { ...request, quantity: reservation.quantity },
      updated,
    );
  }

  private async emitChange(
    manager: EntityManager,
    type: StockChangeEventType,
    request: StockCommandPayload,
    product: ProductLevels,
  ): Promise<void> {
    const payload: StockChangedPayload = {
      orderId: request.orderId,
      productId: product.id,
      quantity: request.quantity,
      stock: product.stock,
      reserved: product.reserved,
    };
    await appendToOutbox(manager, {
      exchange: INVENTORY_EVENTS_EXCHANGE,
      routingKey: STOCK_EVENT_ROUTING_KEYS[type],
      event: createIntegrationEvent({
        aggregateId: product.id,
        version: product.version,
        type,
        payload,
      }),
    });
  }

  private async emitRejection(
    manager: EntityManager,
    request: StockCommandPayload,
    reason: StockRejectionReason,
    product: ProductLevels | null,
  ): Promise<void> {
    const payload: StockReservationRejectedPayload = {
      orderId: request.orderId,
      productId: request.productId,
      quantity: request.quantity,
      reason,
      stock: product?.stock ?? 0,
      reserved: product?.reserved ?? 0,
    };
    await appendToOutbox(manager, {
      exchange: INVENTORY_EVENTS_EXCHANGE,
      routingKey: STOCK_EVENT_ROUTING_KEYS[StockEventType.ReservationRejected],
      event: createIntegrationEvent({
        aggregateId: request.productId,
        version: product?.version ?? 0,
        type: StockEventType.ReservationRejected,
        payload,
      }),
    });
  }
}
