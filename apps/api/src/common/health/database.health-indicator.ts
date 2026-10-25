import type { HealthIndicator } from '@common/health/health-indicator';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<void> {
    await this.dataSource.query('SELECT 1');
  }
}
