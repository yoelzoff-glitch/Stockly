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
  packaging_cost_snapshot?: number | null;
  flex_cost_snapshot?: number | null;
  operational_cost_snapshot_version?: string;
  cost_snapshot_frozen_at?: Date | string | null;
  cost_snapshot_source?: string | null;
  cost_snapshot_status?: 'complete' | 'partial' | 'legacy_missing' | string | null;
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
  line_key?: string | null;
  unit_cost_snapshot?: number | null;
  cost_snapshot_frozen_at?: Date | string | null;
  cost_snapshot_source?: string | null;
  cost_snapshot_version?: string;
  estimated_fee_snapshot?: number | null;
  estimated_shipping_cost_snapshot?: number | null;
  extra_fee_amount_snapshot?: number | null;
  promotion_discount_amount_snapshot?: number | null;
  estimated_tax_snapshot?: number | null;
  created_at: Date | string;
}

