-- Migration: Add is_daily and has_iva columns to monthly_expenses for daily advertising expenses and VAT inclusion
ALTER TABLE public.monthly_expenses
ADD COLUMN IF NOT EXISTS is_daily BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_iva BOOLEAN DEFAULT false;
