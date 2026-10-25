import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProductStockResponse } from '../dto/product-stock.response';
import { ProductsService } from '../service/products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':id')
  getStock(
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<ProductStockResponse> {
    return this.productsService.getStock(productId);
  }
}
