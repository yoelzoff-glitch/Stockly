-- Clean up duplicate order cancellations keeping the oldest one
DELETE FROM public.order_cancellations a
USING public.order_cancellations b
WHERE a.id > b.id
  AND a.order_id = b.order_id;

-- Create a unique index on order_id to prevent future duplicates due to race conditions
CREATE UNIQUE INDEX IF NOT EXISTS order_cancellations_order_id_unique_idx
ON public.order_cancellations (order_id);
