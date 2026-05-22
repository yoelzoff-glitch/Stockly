-- Script de Migración para agregar columnas de rentabilidad a la tabla products

-- Primero eliminamos las columnas si estaban creadas como 'Generated Columns' previamente
ALTER TABLE public.products DROP COLUMN IF EXISTS margin_amount CASCADE;
ALTER TABLE public.products DROP COLUMN IF EXISTS margin_percent CASCADE;

-- Luego agregamos todas las columnas como valores numéricos normales
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS estimated_fee numeric,
ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric,
ADD COLUMN IF NOT EXISTS estimated_tax numeric,
ADD COLUMN margin_amount numeric,
ADD COLUMN margin_percent numeric,
ADD COLUMN IF NOT EXISTS profitability_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS profit_last_calculated_at timestamptz,
ADD COLUMN IF NOT EXISTS profit_raw_data jsonb DEFAULT '{}'::jsonb;

