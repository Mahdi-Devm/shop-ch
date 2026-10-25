import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { OrderStatus } from '../entities/order.entity';
import { OrderEntity } from '../entities/order.entity';

export type NewOrder = Pick<
  OrderEntity,
  'id' | 'userId' | 'productId' | 'quantity' | 'status' | 'version'
>;

export type OrderTransition = {
  orderId: string;
  productId: string;
  quantity: number;
  status: OrderStatus;
  version: number;
};

type TransitionRow = {
  id: string;
  product_id: string;
  quantity: number;
  status: OrderStatus;
  version: number;
};

@Injectable()
export class OrdersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async insert(manager: EntityManager, order: NewOrder): Promise<void> {
    await manager.insert(OrderEntity, order);
  }

  findOwnedBy(orderId: string, userId: string): Promise<OrderEntity | null> {
    return this.dataSource.manager.findOneBy(OrderEntity, {
      id: orderId,
      userId,
    });
  }

  async transition(
    manager: EntityManager,
    orderId: string,
    allowedFrom: readonly OrderStatus[],
    to: OrderStatus,
  ): Promise<OrderTransition | null> {
    const [rows]: [TransitionRow[], number] = await manager.query(
      `UPDATE orders
          SET status = $3, version = version + 1, updated_at = now()
        WHERE id = $1 AND status = ANY($2::varchar[])
        RETURNING id, product_id, quantity, status, version`,
      [orderId, allowedFrom, to],
    );
    const [row] = rows;
    if (!row) {
      return null;
    }
    return {
      orderId: row.id,
      productId: row.product_id,
      quantity: row.quantity,
      status: row.status,
      version: row.version,
    };
  }
}
