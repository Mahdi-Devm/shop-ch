import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEventEntity {
  @PrimaryColumn('varchar', { length: 64 })
  consumer: string;

  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
