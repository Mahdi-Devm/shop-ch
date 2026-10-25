import { BaseEnvironment } from '@common/config/base-environment';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class InventoryEnvironment extends BaseEnvironment {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT_INVENTORY = 3002;

  @IsString()
  @IsNotEmpty()
  INVENTORY_DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  INVENTORY_DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  INVENTORY_DB: string;
}
