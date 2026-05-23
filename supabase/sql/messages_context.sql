-- supabase/sql/messages_context.sql
-- Migración para el soporte de memoria conversacional (Sprint 29)

-- Agregamos la columna product_id a la tabla messages si no existe
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Creamos un índice para acelerar búsquedas de mensajes por producto
CREATE INDEX IF NOT EXISTS idx_messages_product_id ON messages(product_id);
