-- Migration: Add start_month and end_month to monthly_expenses for historical tracking
ALTER TABLE public.monthly_expenses
ADD COLUMN start_month DATE DEFAULT date_trunc('month', CURRENT_DATE),
ADD COLUMN end_month DATE;

-- Update existing expenses to start from their creation month
UPDATE public.monthly_expenses
SET start_month = date_trunc('month', created_at)
WHERE start_month IS NULL;
