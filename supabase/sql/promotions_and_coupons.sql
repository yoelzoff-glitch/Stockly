-- Sprint 31: Promociones y Cupones de Mercado Libre

CREATE TABLE public.promotions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_promotion_id text,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    title text,
    description text,
    discount_type text,
    discount_value numeric,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    target_audience text,
    raw_payload jsonb DEFAULT '{}'::jsonb,
    raw_response jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promotions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.promotion_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    meli_item_id text,
    current_price numeric,
    discount_price numeric,
    discount_percent numeric,
    expected_margin numeric,
    status text DEFAULT 'pending',
    raw_response jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promotion_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.coupons (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meli_coupon_id text,
    title text,
    code text,
    coupon_type text,
    discount_type text,
    discount_value numeric,
    min_purchase_amount numeric,
    max_uses integer,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    target_audience text,
    status text DEFAULT 'draft',
    raw_payload jsonb DEFAULT '{}'::jsonb,
    raw_response jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coupons_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_promotions_tenant_id ON public.promotions USING btree (tenant_id);
CREATE INDEX idx_promotions_status ON public.promotions USING btree (status);
CREATE INDEX idx_promotions_type ON public.promotions USING btree (type);
CREATE INDEX idx_promotions_starts_at ON public.promotions USING btree (starts_at);
CREATE INDEX idx_promotions_ends_at ON public.promotions USING btree (ends_at);

CREATE INDEX idx_promotion_items_tenant_id ON public.promotion_items USING btree (tenant_id);
CREATE INDEX idx_promotion_items_promotion_id ON public.promotion_items USING btree (promotion_id);

CREATE INDEX idx_coupons_tenant_id ON public.coupons USING btree (tenant_id);
CREATE INDEX idx_coupons_status ON public.coupons USING btree (status);
CREATE INDEX idx_coupons_type ON public.coupons USING btree (coupon_type);
CREATE INDEX idx_coupons_starts_at ON public.coupons USING btree (starts_at);
CREATE INDEX idx_coupons_ends_at ON public.coupons USING btree (ends_at);
