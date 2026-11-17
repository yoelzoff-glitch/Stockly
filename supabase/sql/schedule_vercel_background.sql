-- Execute as postgres AFTER deploying the Vercel Hobby-compatible configuration.
-- Prerequisites (enter credentials in the dashboards, not in this file):
-- 1. Vercel Production environment: CRON_SECRET = a random secret (32+ characters).
-- 2. Supabase Vault secrets:
--    libretax_background_url = stable production origin, e.g. https://your-domain.com
--    libretax_cron_secret = exactly the same value as Vercel's CRON_SECRET.
-- This does not reapply or change the queue migrations already installed.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_libretax_background()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE origin text; secret text;
BEGIN
  SELECT decrypted_secret INTO origin FROM vault.decrypted_secrets
    WHERE name = 'libretax_background_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets
    WHERE name = 'libretax_cron_secret';
  IF origin IS NULL OR origin !~ '^https://[A-Za-z0-9.-]+(:443)?/?$' THEN
    RAISE EXCEPTION 'Configure a valid HTTPS production origin in Vault: libretax_background_url';
  END IF;
  IF secret IS NULL OR length(secret) < 32 THEN
    RAISE EXCEPTION 'Configure Vault libretax_cron_secret (32+ characters), matching Vercel CRON_SECRET';
  END IF;
  RETURN net.http_get(
    url := rtrim(origin, '/') || '/api/cron/background',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 300000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_libretax_background() FROM PUBLIC, anon, authenticated, service_role;

-- Validate configuration before scheduling anything. Do not send a request yet.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets
    WHERE name='libretax_background_url' AND decrypted_secret ~ '^https://[A-Za-z0-9.-]+(:443)?/?$')
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets
    WHERE name='libretax_cron_secret' AND length(decrypted_secret) >= 32) THEN
    RAISE EXCEPTION 'Missing Vault configuration. Create libretax_background_url and libretax_cron_secret first.';
  END IF;
END;
$$;

-- Named schedules are updated on re-execution instead of duplicated.
-- 00:00, 00:45, 01:30, 02:15, 03:00 ... exactly 32 HTTP requests per day.
SELECT cron.schedule('libretax-background-45m-a', '0 */3 * * *', 'SELECT public.trigger_libretax_background();');
SELECT cron.schedule('libretax-background-45m-b', '45 */3 * * *', 'SELECT public.trigger_libretax_background();');
SELECT cron.schedule('libretax-background-45m-c', '30 1-23/3 * * *', 'SELECT public.trigger_libretax_background();');
SELECT cron.schedule('libretax-background-45m-d', '15 2-23/3 * * *', 'SELECT public.trigger_libretax_background();');
COMMIT;

-- A successful cron run only means the HTTP request was queued by pg_net.
-- Check HTTP results separately (without printing authorization headers):
-- SELECT id, status_code, timed_out, error_msg, created
-- FROM net._http_response ORDER BY created DESC LIMIT 10;
