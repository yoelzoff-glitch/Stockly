-- ==============================================================================
-- SPRINT: MARKETING LEADS & CONTACT CHANNELS
-- Migration: 20260920000001_marketing_leads_phone.sql
-- Description: Add phone column to marketing_leads for WhatsApp and call follow-up
-- ==============================================================================

ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS phone text;
