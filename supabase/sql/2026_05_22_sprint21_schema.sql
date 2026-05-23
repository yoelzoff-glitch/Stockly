-- Script de Migración para Sprint 21: IA Contextual por Producto

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

-- Crear un índice para búsquedas rápidas de historial de mensajes por producto
CREATE INDEX IF NOT EXISTS idx_messages_product_id ON public.messages(product_id);
