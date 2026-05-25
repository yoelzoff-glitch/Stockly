-- supabase/sql/internal_inventory_purchases.sql
-- Sprint 34: Compras internas + Stock de depósito + Costeo automático de publicaciones compuestas

-- 1. Create table inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    sku_normalized TEXT NOT NULL,
    name TEXT,
    category TEXT,
    unit_cost NUMERIC,
    average_cost NUMERIC,
    last_purchase_cost NUMERIC,
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_sku_normalized UNIQUE (tenant_id, sku_normalized)
);

-- 2. Create table purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_name TEXT,
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    total_amount NUMERIC,
    extra_costs NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'completed', -- 'completed', 'voided'
    source TEXT DEFAULT 'ai', -- 'ai', 'dashboard', 'import', 'system'
    raw_input TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    sku_normalized TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create table inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- 'purchase', 'adjustment', 'sale_reserved', 'sale_confirmed', 'return', 'manual', 'void_purchase'
    quantity_delta INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    source TEXT, -- 'ai', 'dashboard', 'import', 'system'
    reference_id UUID, -- purchase_order_id, etc.
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create table product_components
CREATE TABLE IF NOT EXISTS public.product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    component_sku TEXT NOT NULL,
    component_normalized TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC,
    total_component_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_product_component_normalized UNIQUE (tenant_id, product_id, component_normalized)
);

-- 6. Create table product_extra_costs
CREATE TABLE IF NOT EXISTS public.product_extra_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    cost_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed', 'percent'
    applies_to TEXT NOT NULL DEFAULT 'product', -- 'product', 'category', 'all'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON public.inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku_normalized);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_product_components_product ON public.product_components(product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_item ON public.product_components(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_product_extra_costs_tenant ON public.product_extra_costs(tenant_id);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_extra_costs ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies
CREATE POLICY "Users can manage their tenant's inventory_items" ON public.inventory_items
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant's purchase_orders" ON public.purchase_orders
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant's purchase_order_items" ON public.purchase_order_items
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant's inventory_movements" ON public.inventory_movements
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant's product_components" ON public.product_components
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant's product_extra_costs" ON public.product_extra_costs
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
