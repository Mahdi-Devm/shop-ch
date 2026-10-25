import { ENV_FILE_PATHS } from '@common/config/env-file-paths';
import { createEnvironmentValidator } from '@common/config/validate-environment';
import { DatabaseHealthIndicator } from '@common/health/database.health-indicator';
import { HealthModule } from '@common/health/health.module';
import { RequestLoggingMiddleware } from '@common/logging/request-logging.middleware';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettingsFromConfig,
} from './config/order-database.config';
import { OrderEnvironment } from './config/order-environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validate: createEnvironmentValidator(OrderEnvironment),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<OrderEnvironment, true>) => ({
        ...createOrderDataSourceOptions(
          orderDatabaseSettingsFromConfig(configService),
        ),
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    HealthModule.register([DatabaseHealthIndicator]),
  ],
})
export class OrderAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*path');
  }
}
