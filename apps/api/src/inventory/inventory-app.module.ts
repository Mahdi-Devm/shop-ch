import { JwtAuthGuard } from '@common/auth/jwt-auth.guard';
import { JwtAuthModule } from '@common/auth/jwt-auth.module';
import { ENV_FILE_PATHS } from '@common/config/env-file-paths';
import { createEnvironmentValidator } from '@common/config/validate-environment';
import { DatabaseHealthIndicator } from '@common/health/database.health-indicator';
import { HealthModule } from '@common/health/health.module';
import { RequestLoggingMiddleware } from '@common/logging/request-logging.middleware';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettingsFromConfig,
} from './config/inventory-database.config';
import { InventoryEnvironment } from './config/inventory-environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validate: createEnvironmentValidator(InventoryEnvironment),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<InventoryEnvironment, true>,
      ) => ({
        ...createInventoryDataSourceOptions(
          inventoryDatabaseSettingsFromConfig(configService),
        ),
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    JwtAuthModule,
    HealthModule.register([DatabaseHealthIndicator]),
  ],
  providers: [{ provide: APP_GUARD, useExisting: JwtAuthGuard }],
})
export class InventoryAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*path');
  }
}
