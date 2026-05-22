export interface Product {
  id: string;
  tenant_id: string;
  meli_account_id?: string;
  meli_item_id: string;
  title: string;
  sku?: string;
  permalink?: string;
  thumbnail_url?: string;
  status?: string;
  listing_type_id?: string;
  category_id?: string;
  price: number;
  base_price?: number;
  original_price?: number;
  available_quantity: number;
  sold_quantity: number;
  cost?: number;
  estimated_fee?: number;
  estimated_shipping_cost?: number;
  estimated_tax?: number;
  margin_amount?: number;
  margin_percent?: number;
  raw_data: Record<string, any>;
  last_synced_at?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ProductPriceHistory {
  id: string;
  tenant_id: string;
  product_id: string;
  old_price?: number;
  new_price: number;
  changed_by?: string;
  source: string;
  created_at: Date | string;
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  movement_type: string;
  quantity_delta: number;
  previous_quantity?: number;
  new_quantity?: number;
  reason?: string;
  source: string;
  changed_by?: string;
  created_at: Date | string;
}
