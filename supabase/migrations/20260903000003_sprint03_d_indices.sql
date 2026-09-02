-- SPRINT 3 — MIGRACIÓN D: ÍNDICES DE RENDIMIENTO PARA RLS Y AISLAMIENTO MULTI-TENANT
-- PREFLIGHT:
-- Crea índices B-tree condicionales verificando columnas existentes para evitar bloqueos y fallos.

DO $$
BEGIN
  -- Products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'meli_item_id') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant_meli_item ON public.products(tenant_id, meli_item_id);
  END IF;

  -- Orders
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'date_created') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON public.orders(tenant_id, date_created DESC);
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);
  END IF;

  -- Shipments (Soporte para subconsulta EXISTS)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
  END IF;

  -- Monthly expenses (Verificación explícita de columnas date vs month)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_expenses' AND column_name = 'date') THEN
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_date ON public.monthly_expenses(tenant_id, date DESC);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monthly_expenses' AND column_name = 'month') THEN
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_month ON public.monthly_expenses(tenant_id, month);
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_expenses') THEN
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_id ON public.monthly_expenses(tenant_id);
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
