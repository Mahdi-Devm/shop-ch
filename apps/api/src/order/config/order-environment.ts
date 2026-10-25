import { BaseEnvironment } from '@common/config/base-environment';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OrderEnvironment extends BaseEnvironment {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT_ORDER = 3001;

  @IsString()
  @IsOptional()
  CORS_ORIGIN = '';

  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;

  @Type(() => Number)
  @IsInt()
  POSTGRES_PORT: number;

  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @Type(() => Number)
  @IsInt()
  REDIS_PORT: number;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN_SECONDS = 3600;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_IP_LIMIT = 10;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_USER_LIMIT = 5;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  THROTTLE_TTL_MS = 1000;
}
