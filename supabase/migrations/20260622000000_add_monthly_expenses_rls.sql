-- 1. Asegurar que RLS esté habilitado
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes si las hubiera
DROP POLICY IF EXISTS "Users can read their tenant's monthly expenses" ON public.monthly_expenses;
DROP POLICY IF EXISTS "Users can insert their tenant's monthly expenses" ON public.monthly_expenses;
DROP POLICY IF EXISTS "Users can update their tenant's monthly expenses" ON public.monthly_expenses;
DROP POLICY IF EXISTS "Users can delete their tenant's monthly expenses" ON public.monthly_expenses;

-- 3. Crear política para SELECT (Lectura)
CREATE POLICY "Users can read their tenant's monthly expenses"
  ON public.monthly_expenses
  FOR SELECT
  USING ( tenant_id in (select tenant_id from profiles where id = auth.uid()) );

-- 4. Crear política para INSERT (Inserción)
CREATE POLICY "Users can insert their tenant's monthly expenses"
  ON public.monthly_expenses
  FOR INSERT
  WITH CHECK ( tenant_id in (select tenant_id from profiles where id = auth.uid()) );

-- 5. Crear política para UPDATE (Actualización)
CREATE POLICY "Users can update their tenant's monthly expenses"
  ON public.monthly_expenses
  FOR UPDATE
  USING ( tenant_id in (select tenant_id from profiles where id = auth.uid()) )
  WITH CHECK ( tenant_id in (select tenant_id from profiles where id = auth.uid()) );

-- 6. Crear política para DELETE (Eliminación)
CREATE POLICY "Users can delete their tenant's monthly expenses"
  ON public.monthly_expenses
  FOR DELETE
  USING ( tenant_id in (select tenant_id from profiles where id = auth.uid()) );
