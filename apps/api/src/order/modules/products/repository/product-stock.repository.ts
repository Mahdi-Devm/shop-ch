import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProductStockViewEntity } from '../entities/product-stock-view.entity';

export type ProductStockLevels = Pick<
  ProductStockViewEntity,
  'productId' | 'stock' | 'reserved' | 'version'
>;

@Injectable()
export class ProductStockRepository {
  constructor(private readonly dataSource: DataSource) {}

  find(
    productId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<ProductStockViewEntity | null> {
    return manager.findOneBy(ProductStockViewEntity, { productId });
  }

  async applyIfNewer(
    manager: EntityManager,
    levels: ProductStockLevels,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO product_stock_view (product_id, stock, reserved, version)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id) DO UPDATE
         SET stock = EXCLUDED.stock,
             reserved = EXCLUDED.reserved,
             version = EXCLUDED.version,
             updated_at = now()
         WHERE product_stock_view.version < EXCLUDED.version`,
      [levels.productId, levels.stock, levels.reserved, levels.version],
    );
  }
}
