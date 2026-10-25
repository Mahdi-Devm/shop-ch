import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKeyEntity {
  @PrimaryColumn('varchar', { name: 'user_id', length: 64 })
  userId: string;

  @PrimaryColumn('uuid', { name: 'idempotency_key' })
  key: string;

  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('varchar', { name: 'request_hash', length: 64 })
  requestHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index('idx_idempotency_keys_expires_at')
  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;
}
