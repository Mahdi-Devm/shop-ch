import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_stock_view')
export class ProductStockViewEntity {
  @PrimaryColumn('uuid', { name: 'product_id' })
  productId: string;

  @Column('integer')
  stock: number;

  @Column('integer')
  reserved: number;

  @Column('integer')
  version: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
