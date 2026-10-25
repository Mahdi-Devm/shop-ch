import { ApiException } from '@common/exceptions/api.exception';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { ProductStockResponse } from '../dto/product-stock.response';
import { ProductStockRepository } from '../repository/product-stock.repository';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productStockRepository: ProductStockRepository,
  ) {}

  async getStock(productId: string): Promise<ProductStockResponse> {
    const product = await this.productStockRepository.find(productId);
    if (!product) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    return {
      id: product.productId,
      stock: product.stock,
      reserved: product.reserved,
    };
  }
}
