import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const OrderStatus = {
  Pending: 'Pending',
  Reserved: 'Reserved',
  Paid: 'Paid',
  Cancelled: 'Cancelled',
  Expired: 'Expired',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Paid,
  OrderStatus.Cancelled,
  OrderStatus.Expired,
];

@Entity('orders')
@Check('chk_orders_quantity_positive', '"quantity" > 0')
@Check('chk_orders_version_positive', '"version" > 0')
export class OrderEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('idx_orders_user_id')
  @Column('varchar', { name: 'user_id', length: 64 })
  userId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('integer')
  quantity: number;

  @Column('varchar', { length: 16 })
  status: OrderStatus;

  @Column('integer')
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
