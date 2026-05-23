-- Script de Migración para Módulo de Rentabilidad Real Avanzada (Sprint 20)

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS campaign_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS promotion_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS extra_fee_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_discount_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_adjustments jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS profit_real_estimated numeric,
ADD COLUMN IF NOT EXISTS profit_real_margin numeric;
