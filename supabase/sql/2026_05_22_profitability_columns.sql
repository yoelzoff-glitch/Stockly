-- Script de Migración para agregar columnas de rentabilidad a la tabla products

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS estimated_fee numeric,
ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric,
ADD COLUMN IF NOT EXISTS estimated_tax numeric,
ADD COLUMN IF NOT EXISTS margin_amount numeric,
ADD COLUMN IF NOT EXISTS margin_percent numeric,
ADD COLUMN IF NOT EXISTS profitability_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS profit_last_calculated_at timestamptz,
ADD COLUMN IF NOT EXISTS profit_raw_data jsonb DEFAULT '{}'::jsonb;
