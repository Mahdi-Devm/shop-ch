import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
@Check('chk_products_stock_non_negative', '"stock" >= 0')
@Check('chk_products_reserved_non_negative', '"reserved" >= 0')
@Check('chk_products_sold_non_negative', '"sold" >= 0')
@Check(
  'chk_products_quantities_balance',
  '"stock" + "reserved" + "sold" = "initial_stock"',
)
export class ProductEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar', { length: 200 })
  name: string;

  @Column('integer', { name: 'initial_stock' })
  initialStock: number;

  @Column('integer')
  stock: number;

  @Column('integer')
  reserved: number;

  @Column('integer')
  sold: number;

  @Column('integer')
  version: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
