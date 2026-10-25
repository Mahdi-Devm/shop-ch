import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { IdempotencyKeyEntity } from '../entities/idempotency-key.entity';

export type IdempotencyClaim = Pick<
  IdempotencyKeyEntity,
  'userId' | 'key' | 'orderId' | 'requestHash' | 'expiresAt'
>;

@Injectable()
export class IdempotencyKeysRepository {
  constructor(private readonly dataSource: DataSource) {}

  async claim(
    manager: EntityManager,
    claim: IdempotencyClaim,
  ): Promise<boolean> {
    const inserted: unknown[] = await manager.query(
      `INSERT INTO idempotency_keys
         (user_id, idempotency_key, order_id, request_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING order_id`,
      [
        claim.userId,
        claim.key,
        claim.orderId,
        claim.requestHash,
        claim.expiresAt,
      ],
    );
    return inserted.length === 1;
  }

  findForUpdate(
    manager: EntityManager,
    userId: string,
    key: string,
  ): Promise<IdempotencyKeyEntity | null> {
    return manager
      .createQueryBuilder(IdempotencyKeyEntity, 'idempotency')
      .where('idempotency.userId = :userId', { userId })
      .andWhere('idempotency.key = :key', { key })
      .setLock('pessimistic_write')
      .getOne();
  }

  async remove(
    manager: EntityManager,
    userId: string,
    key: string,
  ): Promise<void> {
    await manager.delete(IdempotencyKeyEntity, { userId, key });
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.dataSource.manager.delete(IdempotencyKeyEntity, {
      expiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }
}
