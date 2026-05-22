export interface Order {
  id: string;
  tenant_id: string;
  meli_account_id?: string;
  meli_order_id: string;
  status?: string;
  buyer_nickname?: string;
  buyer_id?: string;
  total_amount: number;
  paid_amount?: number;
  currency_id?: string;
  date_created?: Date | string;
  date_closed?: Date | string;
  raw_data: Record<string, any>;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  product_id?: string;
  meli_item_id?: string;
  title: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  unit_cost?: number;
  estimated_fee?: number;
  estimated_shipping_cost?: number;
  estimated_tax?: number;
  created_at: Date | string;
}
