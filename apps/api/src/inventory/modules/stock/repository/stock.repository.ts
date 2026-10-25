import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { ProductEntity } from '../entities/product.entity';
import {
  ReservationEntity,
  ReservationStatus,
} from '../entities/reservation.entity';

export type ProductLevels = Pick<
  ProductEntity,
  'id' | 'stock' | 'reserved' | 'sold' | 'version'
>;

@Injectable()
export class StockRepository {
  lockProduct(
    manager: EntityManager,
    productId: string,
  ): Promise<ProductEntity | null> {
    return manager
      .createQueryBuilder(ProductEntity, 'product')
      .where('product.id = :productId', { productId })
      .setLock('pessimistic_write')
      .getOne();
  }

  async saveLevels(
    manager: EntityManager,
    product: ProductLevels,
  ): Promise<void> {
    await manager.update(
      ProductEntity,
      { id: product.id },
      {
        stock: product.stock,
        reserved: product.reserved,
        sold: product.sold,
        version: product.version,
      },
    );
  }

  findReservationByOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<ReservationEntity | null> {
    return manager.findOneBy(ReservationEntity, { orderId });
  }

  async createReservation(
    manager: EntityManager,
    reservation: Pick<ReservationEntity, 'orderId' | 'productId' | 'quantity'>,
  ): Promise<void> {
    await manager.insert(ReservationEntity, {
      id: randomUUID(),
      ...reservation,
      status: ReservationStatus.Reserved,
    });
  }

  async updateReservationStatus(
    manager: EntityManager,
    reservationId: string,
    status: ReservationStatus,
  ): Promise<void> {
    await manager.update(ReservationEntity, { id: reservationId }, { status });
  }
}
