-- SPRINT 3 — MIGRACIÓN D: ÍNDICES DE RENDIMIENTO PARA RLS Y AISLAMIENTO MULTI-TENANT
-- PREFLIGHT: Crea índices B-tree condicionales verificando columnas existentes para evitar bloqueos y fallos.

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

  -- Monthly expenses (Columnas reales: target_month, start_month)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_expenses') THEN
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_target_month ON public.monthly_expenses(tenant_id, target_month);
    CREATE INDEX IF NOT EXISTS idx_monthly_expenses_tenant_start_month ON public.monthly_expenses(tenant_id, start_month);
  END IF;

  -- Child tables foreign key indices for EXISTS subquery acceleration
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_cancellations') THEN
    CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_id ON public.order_cancellations(order_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_steps') THEN
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_wf_id ON public.workflow_steps(workflow_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_adjustment_details') THEN
    CREATE INDEX IF NOT EXISTS idx_price_adjustment_details_wf_id ON public.price_adjustment_details(workflow_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history') THEN
    CREATE INDEX IF NOT EXISTS idx_product_price_history_prod_id ON public.product_price_history(product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_id ON public.stock_movements(product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotion_items') THEN
    CREATE INDEX IF NOT EXISTS idx_promotion_items_promo_id ON public.promotion_items(promotion_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_components') THEN
    CREATE INDEX IF NOT EXISTS idx_product_components_prod_id ON public.product_components(product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_sku_components') THEN
    CREATE INDEX IF NOT EXISTS idx_product_sku_components_prod_id ON public.product_sku_components(product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_extra_costs') THEN
    CREATE INDEX IF NOT EXISTS idx_product_extra_costs_prod_id ON public.product_extra_costs(product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(inventory_item_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alerts') THEN
    CREATE INDEX IF NOT EXISTS idx_alerts_alert_rule_id ON public.alerts(alert_rule_id);
  END IF;
END $$;
