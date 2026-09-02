-- SPRINT 3 — MIGRACIÓN D: ÍNDICES DE RENDIMIENTO PARA RLS Y AISLAMIENTO MULTI-TENANT
-- PREFLIGHT:
-- Crea índices B-tree para optimizar la resolución de tenant_id y subconsultas EXISTS.

DO $$
BEGIN
  -- Products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_products_tenant_meli_item ON public.products(tenant_id, meli_item_id);
  END IF;

  -- Orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON public.orders(tenant_id, date_created DESC);
  END IF;

  -- Shipments (Soporte para subconsulta EXISTS)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
  END IF;

  -- Monthly expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_expenses') THEN
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_date ON public.monthly_expenses(tenant_id, date DESC);
  END IF;

  -- Purchase orders & items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);
  END IF;

  -- Price adjustment details
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_adjustment_details') THEN
    CREATE INDEX IF NOT EXISTS idx_price_adjustment_details_wf_id ON public.price_adjustment_details(workflow_id);
  END IF;
END $$;
