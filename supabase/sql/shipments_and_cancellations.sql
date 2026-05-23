-- ======================================================
-- SPRINT 22: Envíos + Ventas Canceladas
-- ======================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS meli_shipment_id text;

-- 1. Tabla shipments
CREATE TABLE IF NOT EXISTS shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    meli_shipment_id text,
    status text,
    substatus text,
    logistic_type text,
    mode text,
    tracking_number text,
    tracking_method text,
    shipping_cost numeric DEFAULT 0,
    receiver_city text,
    receiver_state text,
    date_created timestamptz,
    last_updated timestamptz,
    raw_data jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_tenant_id_idx ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON shipments(status);
CREATE INDEX IF NOT EXISTS shipments_date_created_idx ON shipments(date_created);
CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON shipments(order_id);
CREATE INDEX IF NOT EXISTS shipments_meli_shipment_id_idx ON shipments(meli_shipment_id);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shipments"
    ON shipments FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert their own shipments"
    ON shipments FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their own shipments"
    ON shipments FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their own shipments"
    ON shipments FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));


-- 2. Tabla order_cancellations
CREATE TABLE IF NOT EXISTS order_cancellations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    meli_order_id text,
    reason text,
    cancelled_by text,
    refund_amount numeric DEFAULT 0,
    date_cancelled timestamptz,
    raw_data jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_cancellations_tenant_id_idx ON order_cancellations(tenant_id);
CREATE INDEX IF NOT EXISTS order_cancellations_order_id_idx ON order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS order_cancellations_date_cancelled_idx ON order_cancellations(date_cancelled);

ALTER TABLE order_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order_cancellations"
    ON order_cancellations FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert their own order_cancellations"
    ON order_cancellations FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their own order_cancellations"
    ON order_cancellations FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their own order_cancellations"
    ON order_cancellations FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));
