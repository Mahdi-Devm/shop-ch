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
}
