import { AuthorizationModule } from '@common/modules/authorization.module';
import { AppCacheModule } from '@common/modules/cache.module';
import { RedisModule } from '@common/modules/redis.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ProjectModule } from './modules/project/project.module';
import { FindingModule } from './modules/finding/finding.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfig }),
    RedisModule.forRootAsync(),
    AuthorizationModule,
    AppCacheModule,
    AuthModule,
    OrganizationModule,
    ActivityModule,
    ProjectModule,
    FindingModule,
    DashboardModule,
  ],
})
export class AppModule {}
