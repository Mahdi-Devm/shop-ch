import { UUID_PATTERN } from '@common/validation/uuid-pattern';
import { Equals, IsInt, IsString, Matches } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Matches(UUID_PATTERN, { message: 'productId must be a UUID' })
  productId: string;

  @IsInt()
  @Equals(1, { message: 'quantity must be exactly 1' })
  quantity: number;
}
