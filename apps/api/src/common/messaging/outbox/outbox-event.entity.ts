import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('outbox_events')
@Index('idx_outbox_events_unpublished', ['occurredAt'], {
  where: '"published_at" IS NULL',
})
export class OutboxEventEntity {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId: string;

  @Column('varchar', { name: 'aggregate_id', length: 64 })
  aggregateId: string;

  @Column('integer', { name: 'aggregate_version' })
  version: number;

  @Column('varchar', { length: 64 })
  type: string;

  @Column('jsonb')
  payload: object;

  @Column('timestamptz', { name: 'occurred_at' })
  occurredAt: Date;

  @Column('varchar', { length: 128 })
  exchange: string;

  @Column('varchar', { name: 'routing_key', length: 128 })
  routingKey: string;

  @Column('timestamptz', { name: 'published_at', nullable: true })
  publishedAt: Date | null;

  @Column('integer', { default: 0 })
  attempts: number;

  @Column('text', { name: 'last_error', nullable: true })
  lastError: string | null;
}
