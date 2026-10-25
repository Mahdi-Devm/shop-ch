export type ProductStock = {
  id: string;
  stock: number;
  reserved: number;
};

export type OrderCreated = {
  orderId: string;
  status: string;
  version: number;
};

export const FLASH_SALE_PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
