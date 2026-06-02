-- Agregar constraint único a la columna tenant_id en la tabla whatsapp_numbers
ALTER TABLE public.whatsapp_numbers 
ADD CONSTRAINT whatsapp_numbers_tenant_id_key UNIQUE (tenant_id);
