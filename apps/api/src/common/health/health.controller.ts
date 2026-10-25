import type { HealthIndicator } from '@common/health/health-indicator';
import { HEALTH_INDICATORS } from '@common/health/health-indicator';
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

type HealthStatus = 'up' | 'down';

const HEALTH_CHECK_TIMEOUT_MS = 2000;

async function withTimeout(check: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Health check timed out')),
      HEALTH_CHECK_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([check, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: HealthIndicator[],
  ) {}

  @Get()
  async check(@Res() response: Response): Promise<void> {
    const results = await Promise.all(
      this.indicators.map(async (indicator) => {
        try {
          await withTimeout(indicator.check());
          return [indicator.name, 'up'] as const;
        } catch {
          return [indicator.name, 'down'] as const;
        }
      }),
    );

    const checks: Record<string, HealthStatus> = Object.fromEntries(results);
    const isHealthy = results.every(([, status]) => status === 'up');

    response
      .status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ status: isHealthy ? 'ok' : 'error', checks });
  }
}
