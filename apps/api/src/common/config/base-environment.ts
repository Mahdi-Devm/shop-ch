import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const;
export type LogLevelName = (typeof LOG_LEVELS)[number];

export class BaseEnvironment {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV: NodeEnvironment = 'development';

  @IsIn(LOG_LEVELS)
  @IsOptional()
  LOG_LEVEL: LogLevelName = 'log';

  @IsString()
  @MinLength(16)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL: string;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  OUTBOX_POLL_INTERVAL_MS = 200;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  MESSAGE_MAX_RETRIES = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MESSAGE_RETRY_DELAY_MS = 1000;
}
