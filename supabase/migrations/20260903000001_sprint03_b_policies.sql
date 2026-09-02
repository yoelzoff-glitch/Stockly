-- SPRINT 3 — MIGRACIÓN B: DECLARACIÓN DE POLÍTICAS RLS IDEMPOTENTES
-- PREFLIGHT:
-- Requiere haber ejecutado la Migración A (funciones en schema private).

DO $$
BEGIN

  --------------------------------------------------------------------------------
  -- 1. TABLA: PROFILES (Aislamiento y no-escalada)
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_update_own_row" ON public.profiles';
    
    -- Lectura: Solo usuarios activos del mismo tenant pueden ver miembros
    EXECUTE 'CREATE POLICY "profiles_select_own_tenant" ON public.profiles
      FOR SELECT TO authenticated
      USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())';

    -- Actualización: Solo su propia fila
    EXECUTE 'CREATE POLICY "profiles_update_own_row" ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid() AND private.current_profile_is_active())
      WITH CHECK (id = auth.uid() AND private.current_profile_is_active())';
  END IF;

  --------------------------------------------------------------------------------
  -- 2. TABLA: TENANTS
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tenants_select_own" ON public.tenants';
    EXECUTE 'DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants';

    EXECUTE 'CREATE POLICY "tenants_select_own" ON public.tenants
      FOR SELECT TO authenticated
      USING (id = private.current_tenant_id() AND private.current_profile_is_active())';

    EXECUTE 'CREATE POLICY "tenants_update_own" ON public.tenants
      FOR UPDATE TO authenticated
      USING (id = private.current_tenant_id() AND private.current_profile_is_active())
      WITH CHECK (id = private.current_tenant_id() AND private.current_profile_is_active())';
  END IF;

  --------------------------------------------------------------------------------
  -- 3. TABLAS CATEGORÍA A: TENANT DIRECTO
  --------------------------------------------------------------------------------
  -- Iterar sobre tablas con tenant_id estándar
  DECLARE
    tbl text;
    direct_tables text[] := ARRAY[
      'products', 'orders', 'order_items', 'order_cancellations', 'meli_accounts',
      'whatsapp_numbers', 'messages', 'alerts', 'ai_actions', 'action_workflows',
      'price_adjustment_workflows', 'audit_logs', 'product_components', 'product_sku_components',
      'product_extra_costs', 'inventory_items', 'inventory_movements', 'purchase_orders',
      'promotions', 'monthly_expenses', 'subscriptions', 'subscription_usage',
      'tenant_progress', 'tenant_preferences'
    ];
  BEGIN
    FOREACH tbl IN ARRAY direct_tables
    LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
      ) THEN
        EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_select" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_insert" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_update" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_delete" ON public.%I', tbl, tbl);

        EXECUTE format('CREATE POLICY "%I_tenant_select" ON public.%I
          FOR SELECT TO authenticated
          USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())', tbl, tbl);

        EXECUTE format('CREATE POLICY "%I_tenant_insert" ON public.%I
          FOR INSERT TO authenticated
          WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())', tbl, tbl);

        EXECUTE format('CREATE POLICY "%I_tenant_update" ON public.%I
          FOR UPDATE TO authenticated
          USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())
          WITH CHECK (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())', tbl, tbl);

        EXECUTE format('CREATE POLICY "%I_tenant_delete" ON public.%I
          FOR DELETE TO authenticated
          USING (tenant_id = private.current_tenant_id() AND private.current_profile_is_active())', tbl, tbl);
      END IF;
    END LOOP;
  END;

  --------------------------------------------------------------------------------
  -- 4. TABLAS CATEGORÍA B: RELACIÓN PADRE MEDIANTE EXISTS
  --------------------------------------------------------------------------------

  -- Shipments -> orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "shipments_tenant_select" ON public.shipments';
    EXECUTE 'DROP POLICY IF EXISTS "shipments_tenant_modify" ON public.shipments';
    
    EXECUTE 'CREATE POLICY "shipments_tenant_select" ON public.shipments
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = shipments.order_id AND o.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';

    EXECUTE 'CREATE POLICY "shipments_tenant_modify" ON public.shipments
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = shipments.order_id AND o.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = shipments.order_id AND o.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Price adjustment details -> price_adjustment_workflows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_adjustment_details') THEN
    EXECUTE 'DROP POLICY IF EXISTS "price_adjustment_details_tenant_all" ON public.price_adjustment_details';
    
    EXECUTE 'CREATE POLICY "price_adjustment_details_tenant_all" ON public.price_adjustment_details
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.price_adjustment_workflows w
        WHERE w.id = price_adjustment_details.workflow_id AND w.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.price_adjustment_workflows w
        WHERE w.id = price_adjustment_details.workflow_id AND w.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Product price history -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_price_history') THEN
    EXECUTE 'DROP POLICY IF EXISTS "product_price_history_tenant_all" ON public.product_price_history';
    
    EXECUTE 'CREATE POLICY "product_price_history_tenant_all" ON public.product_price_history
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_price_history.product_id AND p.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_price_history.product_id AND p.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Stock movements -> products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    EXECUTE 'DROP POLICY IF EXISTS "stock_movements_tenant_all" ON public.stock_movements';
    
    EXECUTE 'CREATE POLICY "stock_movements_tenant_all" ON public.stock_movements
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = stock_movements.product_id AND p.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = stock_movements.product_id AND p.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Purchase order items -> purchase_orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "purchase_order_items_tenant_all" ON public.purchase_order_items';
    
    EXECUTE 'CREATE POLICY "purchase_order_items_tenant_all" ON public.purchase_order_items
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id AND po.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Promotion items -> promotions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotion_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "promotion_items_tenant_all" ON public.promotion_items';
    
    EXECUTE 'CREATE POLICY "promotion_items_tenant_all" ON public.promotion_items
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.promotions pr
        WHERE pr.id = promotion_items.promotion_id AND pr.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.promotions pr
        WHERE pr.id = promotion_items.promotion_id AND pr.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  -- Coupons -> meli_accounts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') THEN
    EXECUTE 'DROP POLICY IF EXISTS "coupons_tenant_all" ON public.coupons';
    
    EXECUTE 'CREATE POLICY "coupons_tenant_all" ON public.coupons
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.meli_accounts ma
        WHERE ma.id = coupons.meli_account_id AND ma.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.meli_accounts ma
        WHERE ma.id = coupons.meli_account_id AND ma.tenant_id = private.current_tenant_id() AND private.current_profile_is_active()
      ))';
  END IF;

  --------------------------------------------------------------------------------
  -- 5. TABLA CATEGORÍA D: PÚBLICA SOLO LECTURA
  --------------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans_config') THEN
    EXECUTE 'DROP POLICY IF EXISTS "plans_config_public_read" ON public.plans_config';
    EXECUTE 'CREATE POLICY "plans_config_public_read" ON public.plans_config
      FOR SELECT TO public
      USING (true)';
  END IF;

END $$;
