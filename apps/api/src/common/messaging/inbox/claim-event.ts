import type { EntityManager } from 'typeorm';

export async function claimEvent(
  manager: EntityManager,
  consumer: string,
  eventId: string,
): Promise<boolean> {
  const inserted: unknown[] = await manager.query(
    `INSERT INTO processed_events (consumer, event_id)
     VALUES ($1, $2)
     ON CONFLICT (consumer, event_id) DO NOTHING
     RETURNING event_id`,
    [consumer, eventId],
  );
  return inserted.length === 1;
}
