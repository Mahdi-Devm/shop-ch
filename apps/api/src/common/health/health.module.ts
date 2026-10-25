import { HealthController } from '@common/health/health.controller';
import type { HealthIndicator } from '@common/health/health-indicator';
import { HEALTH_INDICATORS } from '@common/health/health-indicator';
import type { DynamicModule, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';

@Module({})
export class HealthModule {
  static register(indicatorTypes: Type<HealthIndicator>[]): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        ...indicatorTypes,
        {
          provide: HEALTH_INDICATORS,
          inject: indicatorTypes,
          useFactory: (...indicators: HealthIndicator[]) => indicators,
        },
      ],
    };
  }
}
