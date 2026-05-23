-- Migración: Columnas Seguras de Sincronización e Historial de Refresh

-- 1. Agregar last_seen_at para rastrear cuándo se vio el producto/orden por última vez
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- 2. Agregar columnas de depuración y estado de refresh en meli_accounts
ALTER TABLE public.meli_accounts ADD COLUMN IF NOT EXISTS sync_error text;
ALTER TABLE public.meli_accounts ADD COLUMN IF NOT EXISTS last_success_refresh timestamptz;
