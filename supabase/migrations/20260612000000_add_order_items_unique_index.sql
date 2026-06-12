-- Clean up duplicate order items keeping the oldest one
DELETE FROM public.order_items a
USING public.order_items b
WHERE a.id > b.id
  AND a.order_id = b.order_id
  AND a.meli_item_id = b.meli_item_id
  AND COALESCE(a.sku, '') = COALESCE(b.sku, '');

-- Create a unique index to prevent future duplicates due to race conditions
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_id_meli_item_id_sku_unique_idx 
ON public.order_items (order_id, meli_item_id, COALESCE(sku, ''));
