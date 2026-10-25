import { Module } from '@nestjs/common';
import { ProductsController } from './controller/products.controller';
import { ProductStockRepository } from './repository/product-stock.repository';
import { ProductsService } from './service/products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductStockRepository, ProductsService],
  exports: [ProductStockRepository],
})
export class ProductsModule {}
