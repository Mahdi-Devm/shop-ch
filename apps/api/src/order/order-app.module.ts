import { JwtAuthGuard } from '@common/auth/jwt-auth.guard';
import { JwtAuthModule } from '@common/auth/jwt-auth.module';
import { ENV_FILE_PATHS } from '@common/config/env-file-paths';
import { createEnvironmentValidator } from '@common/config/validate-environment';
import { DatabaseHealthIndicator } from '@common/health/database.health-indicator';
import { HealthModule } from '@common/health/health.module';
import { MessagingModule } from '@common/messaging/messaging.module';
import { RabbitMqHealthIndicator } from '@common/messaging/rabbitmq/rabbitmq.health-indicator';
import { RequestLoggingMiddleware } from '@common/logging/request-logging.middleware';
import { RedisHealthIndicator } from '@common/redis/redis.health-indicator';
import { RedisModule } from '@common/redis/redis.module';
import {
  IpThrottlerGuard,
  UserThrottlerGuard,
} from '@common/throttling/scoped-throttler.guard';
import { ThrottlingModule } from '@common/throttling/throttling.module';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettingsFromConfig,
} from './config/order-database.config';
import { OrderEnvironment } from './config/order-environment';
import { createOrderTopology } from './messaging/order-topology';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';

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
    RedisModule,
    JwtAuthModule,
    ThrottlingModule,
    MessagingModule.forRoot(createOrderTopology),
    HealthModule.register([
      DatabaseHealthIndicator,
      RedisHealthIndicator,
      RabbitMqHealthIndicator,
    ]),
    AuthModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class OrderAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*path');
  }
}
