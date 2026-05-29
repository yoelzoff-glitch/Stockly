-- Agregar columna pending_plan a la tabla subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS pending_plan text;
