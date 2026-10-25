import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

export const ReservationStatus = {
  Reserved: 'Reserved',
  Released: 'Released',
  Committed: 'Committed',
} as const;
export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

@Entity('reservations')
export class ReservationEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('uq_reservations_order_id', { unique: true })
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Index('idx_reservations_product_id')
  @Column('uuid', { name: 'product_id' })
  productId: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column('integer')
  quantity: number;

  @Column('varchar', { length: 16 })
  status: ReservationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
