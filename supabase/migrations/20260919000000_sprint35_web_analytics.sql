-- ==============================================================================
-- SPRINT 35: WEB ANALYTICS & REALTIME INTELLIGENCE
-- Migration: 20260919000000_sprint35_web_analytics.sql
-- ==============================================================================

-- 1. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.web_analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  visitor_id text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  landing_path text,
  exit_path text,
  referrer text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  country_code text,
  country_name text,
  region_code text,
  region_name text,
  city text,
  device_type text DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'other')),
  os text,
  browser text,
  pageviews integer NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 0,
  is_bot boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'production',
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_session_id ON public.web_analytics_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_visitor_id ON public.web_analytics_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_started_at ON public.web_analytics_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_last_seen_at ON public.web_analytics_sessions (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_env_bot ON public.web_analytics_sessions (environment, is_bot, is_internal);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_utm_source ON public.web_analytics_sessions (utm_source);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_utm_campaign ON public.web_analytics_sessions (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_geo ON public.web_analytics_sessions (country_code, region_code);
CREATE INDEX IF NOT EXISTS idx_web_analytics_sessions_device ON public.web_analytics_sessions (device_type);

-- 2. PAGEVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.web_analytics_pageviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  visitor_id text NOT NULL,
  path text NOT NULL,
  page_title text,
  referrer text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  country_code text,
  region_code text,
  device_type text DEFAULT 'desktop',
  is_bot boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'production',
  is_internal boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_occurred_at ON public.web_analytics_pageviews (occurred_at);
CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_path ON public.web_analytics_pageviews (path);
CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_session ON public.web_analytics_pageviews (session_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_visitor ON public.web_analytics_pageviews (visitor_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_env_bot ON public.web_analytics_pageviews (environment, is_bot, is_internal);
CREATE INDEX IF NOT EXISTS idx_web_analytics_pageviews_geo ON public.web_analytics_pageviews (country_code, region_code);

-- 3. CUSTOM EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.web_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  visitor_id text NOT NULL,
  event_name text NOT NULL,
  path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  is_bot boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'production',
  is_internal boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_web_analytics_events_occurred_at ON public.web_analytics_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_web_analytics_events_event_name ON public.web_analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_web_analytics_events_session ON public.web_analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_events_visitor ON public.web_analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_web_analytics_events_env_bot ON public.web_analytics_events (environment, is_bot, is_internal);

-- 4. ATTRIBUTION TABLE (Linking visitor to registered user/tenant)
CREATE TABLE IF NOT EXISTS public.analytics_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id text,
  converted_at timestamp with time zone NOT NULL DEFAULT now(),
  first_source text,
  first_campaign text,
  last_source text,
  last_campaign text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_attribution_visitor_id ON public.analytics_attribution (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_attribution_tenant_id ON public.analytics_attribution (tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_attribution_converted_at ON public.analytics_attribution (converted_at);

-- 5. DAILY AGGREGATIONS TABLE (Long-term historical rollups)
CREATE TABLE IF NOT EXISTS public.web_analytics_daily (
  date date NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  pageviews integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  visitors integer NOT NULL DEFAULT 0,
  new_visitors integer NOT NULL DEFAULT 0,
  avg_duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (date, environment)
);

CREATE INDEX IF NOT EXISTS idx_web_analytics_daily_date ON public.web_analytics_daily (date);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.web_analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_analytics_pageviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_analytics_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.web_analytics_sessions FROM anon, authenticated;
REVOKE ALL ON public.web_analytics_pageviews FROM anon, authenticated;
REVOKE ALL ON public.web_analytics_events FROM anon, authenticated;
REVOKE ALL ON public.analytics_attribution FROM anon, authenticated;
REVOKE ALL ON public.web_analytics_daily FROM anon, authenticated;

GRANT ALL ON public.web_analytics_sessions TO service_role;
GRANT ALL ON public.web_analytics_pageviews TO service_role;
GRANT ALL ON public.web_analytics_events TO service_role;
GRANT ALL ON public.analytics_attribution TO service_role;
GRANT ALL ON public.web_analytics_daily TO service_role;

-- Allow Super Admins to select if querying with authenticated Supabase client
DROP POLICY IF EXISTS "Super admins can read web analytics sessions" ON public.web_analytics_sessions;
CREATE POLICY "Super admins can read web analytics sessions"
  ON public.web_analytics_sessions
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true));

DROP POLICY IF EXISTS "Super admins can read web analytics pageviews" ON public.web_analytics_pageviews;
CREATE POLICY "Super admins can read web analytics pageviews"
  ON public.web_analytics_pageviews
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true));

DROP POLICY IF EXISTS "Super admins can read web analytics events" ON public.web_analytics_events;
CREATE POLICY "Super admins can read web analytics events"
  ON public.web_analytics_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true));

DROP POLICY IF EXISTS "Super admins can read analytics attribution" ON public.analytics_attribution;
CREATE POLICY "Super admins can read analytics attribution"
  ON public.analytics_attribution
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true));

DROP POLICY IF EXISTS "Super admins can read web analytics daily" ON public.web_analytics_daily;
CREATE POLICY "Super admins can read web analytics daily"
  ON public.web_analytics_daily
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true));

-- ==============================================================================
-- 7. ANALYTICS AGGREGATION RPC FUNCTIONS
-- ==============================================================================

-- Overview metrics: visitors, sessions, pageviews, active now, avg duration, pages/session, bounce rate
CREATE OR REPLACE FUNCTION public.get_web_analytics_overview(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH filtered_sessions AS (
    SELECT *
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
  ),
  filtered_pageviews AS (
    SELECT *
    FROM public.web_analytics_pageviews
    WHERE occurred_at >= p_from
      AND occurred_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
  ),
  active_sessions AS (
    SELECT COUNT(DISTINCT session_id) AS active_count
    FROM public.web_analytics_sessions
    WHERE last_seen_at >= (now() - interval '5 minutes')
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
  )
  SELECT jsonb_build_object(
    'total_visitors', COALESCE(COUNT(DISTINCT s.visitor_id), 0),
    'total_sessions', COALESCE(COUNT(DISTINCT s.session_id), 0),
    'total_pageviews', (SELECT COALESCE(COUNT(1), 0) FROM filtered_pageviews),
    'active_now', (SELECT active_count FROM active_sessions),
    'avg_duration_seconds', COALESCE(ROUND(AVG(s.duration_seconds)), 0)::integer,
    'pages_per_session', ROUND(COALESCE(SUM(s.pageviews)::numeric / NULLIF(COUNT(DISTINCT s.session_id), 0), 0), 2),
    'single_page_sessions', COALESCE(COUNT(1) FILTER (WHERE s.pageviews <= 1), 0),
    'bounce_rate', ROUND(COALESCE(COUNT(1) FILTER (WHERE s.pageviews <= 1)::numeric * 100 / NULLIF(COUNT(DISTINCT s.session_id), 0), 0), 1)
  )
  INTO v_result
  FROM filtered_sessions s;

  RETURN v_result;
END;
$$;

-- Timeseries data: daily visitors, sessions, pageviews
CREATE OR REPLACE FUNCTION public.get_web_analytics_timeseries(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS TABLE (
  bucket_date date,
  visitors integer,
  sessions integer,
  pageviews integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_from::date, p_to::date, '1 day'::interval)::date AS day
  ),
  session_agg AS (
    SELECT 
      started_at::date AS day,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      COUNT(DISTINCT session_id)::integer AS sessions
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY started_at::date
  ),
  pageview_agg AS (
    SELECT 
      occurred_at::date AS day,
      COUNT(1)::integer AS pageviews
    FROM public.web_analytics_pageviews
    WHERE occurred_at >= p_from
      AND occurred_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY occurred_at::date
  )
  SELECT 
    d.day AS bucket_date,
    COALESCE(s.visitors, 0) AS visitors,
    COALESCE(s.sessions, 0) AS sessions,
    COALESCE(p.pageviews, 0) AS pageviews
  FROM date_series d
  LEFT JOIN session_agg s ON d.day = s.day
  LEFT JOIN pageview_agg p ON d.day = p.day
  ORDER BY d.day ASC;
END;
$$;

-- Top pages: pageviews, visitors, avg duration, entries, exits
CREATE OR REPLACE FUNCTION public.get_web_analytics_top_pages(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_limit integer DEFAULT 10,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS TABLE (
  path text,
  pageviews integer,
  visitors integer,
  avg_duration_seconds integer,
  entries integer,
  exits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH pv AS (
    SELECT 
      p.path,
      COUNT(1)::integer AS pageviews,
      COUNT(DISTINCT p.visitor_id)::integer AS visitors,
      COALESCE(ROUND(AVG(p.duration_seconds)), 0)::integer AS avg_duration_seconds
    FROM public.web_analytics_pageviews p
    WHERE p.occurred_at >= p_from
      AND p.occurred_at <= p_to
      AND (p_env = 'all' OR p.environment = p_env)
      AND p.is_bot = false
      AND (NOT p_exclude_internal OR p.is_internal = false)
    GROUP BY p.path
  ),
  ent AS (
    SELECT 
      s.landing_path,
      COUNT(1)::integer AS entries
    FROM public.web_analytics_sessions s
    WHERE s.started_at >= p_from
      AND s.started_at <= p_to
      AND (p_env = 'all' OR s.environment = p_env)
      AND s.is_bot = false
      AND (NOT p_exclude_internal OR s.is_internal = false)
    GROUP BY s.landing_path
  ),
  ex AS (
    SELECT 
      s.exit_path,
      COUNT(1)::integer AS exits
    FROM public.web_analytics_sessions s
    WHERE s.started_at >= p_from
      AND s.started_at <= p_to
      AND (p_env = 'all' OR s.environment = p_env)
      AND s.is_bot = false
      AND (NOT p_exclude_internal OR s.is_internal = false)
    GROUP BY s.exit_path
  )
  SELECT 
    pv.path,
    pv.pageviews,
    pv.visitors,
    pv.avg_duration_seconds,
    COALESCE(ent.entries, 0) AS entries,
    COALESCE(ex.exits, 0) AS exits
  FROM pv
  LEFT JOIN ent ON pv.path = ent.landing_path
  LEFT JOIN ex ON pv.path = ex.exit_path
  ORDER BY pv.pageviews DESC
  LIMIT p_limit;
END;
$$;

-- Traffic sources: Direct, Google, Instagram, Facebook, LinkedIn, Mercado Libre, etc.
CREATE OR REPLACE FUNCTION public.get_web_analytics_sources(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS TABLE (
  source_name text,
  sessions integer,
  visitors integer,
  pageviews integer,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_sessions numeric;
BEGIN
  SELECT NULLIF(COUNT(1)::numeric, 0) INTO v_total_sessions
  FROM public.web_analytics_sessions
  WHERE started_at >= p_from
    AND started_at <= p_to
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false);

  RETURN QUERY
  WITH categorized AS (
    SELECT 
      CASE 
        WHEN utm_source IS NOT NULL AND utm_source <> '' THEN utm_source
        WHEN referrer_domain ILIKE '%google%' THEN 'Google'
        WHEN referrer_domain ILIKE '%instagram%' THEN 'Instagram'
        WHEN referrer_domain ILIKE '%facebook%' OR referrer_domain ILIKE '%fb.%' THEN 'Facebook'
        WHEN referrer_domain ILIKE '%linkedin%' THEN 'LinkedIn'
        WHEN referrer_domain ILIKE '%mercadolibre%' OR referrer_domain ILIKE '%mercadopago%' THEN 'Mercado Libre'
        WHEN referrer_domain ILIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN referrer IS NULL OR referrer = '' THEN 'Directo'
        ELSE COALESCE(referrer_domain, 'Referral')
      END AS channel,
      visitor_id,
      session_id,
      pageviews
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
  )
  SELECT 
    channel AS source_name,
    COUNT(DISTINCT session_id)::integer AS sessions,
    COUNT(DISTINCT visitor_id)::integer AS visitors,
    COALESCE(SUM(pageviews), 0)::integer AS pageviews,
    ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total_sessions, 0), 1) AS percentage
  FROM categorized
  GROUP BY channel
  ORDER BY sessions DESC;
END;
$$;

-- UTM Campaigns breakdown
CREATE OR REPLACE FUNCTION public.get_web_analytics_campaigns(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS TABLE (
  campaign text,
  source text,
  medium text,
  visitors integer,
  sessions integer,
  pageviews integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    utm_campaign AS campaign,
    COALESCE(utm_source, '(none)') AS source,
    COALESCE(utm_medium, '(none)') AS medium,
    COUNT(DISTINCT visitor_id)::integer AS visitors,
    COUNT(DISTINCT session_id)::integer AS sessions,
    COALESCE(SUM(pageviews), 0)::integer AS pageviews
  FROM public.web_analytics_sessions
  WHERE started_at >= p_from
    AND started_at <= p_to
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false)
    AND utm_campaign IS NOT NULL
    AND utm_campaign <> ''
  GROUP BY utm_campaign, utm_source, utm_medium
  ORDER BY sessions DESC;
END;
$$;

-- Devices, Browser, OS Breakdown
CREATE OR REPLACE FUNCTION public.get_web_analytics_devices(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_total numeric;
BEGIN
  SELECT NULLIF(COUNT(1)::numeric, 0) INTO v_total
  FROM public.web_analytics_sessions
  WHERE started_at >= p_from
    AND started_at <= p_to
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false);

  -- Devices breakdown
  SELECT jsonb_agg(d) INTO v_devices
  FROM (
    SELECT 
      device_type,
      COUNT(DISTINCT session_id)::integer AS sessions,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total, 0), 1) AS percentage
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY device_type
    ORDER BY sessions DESC
  ) d;

  -- Browsers breakdown
  SELECT jsonb_agg(b) INTO v_browsers
  FROM (
    SELECT 
      COALESCE(browser, 'Other') AS browser,
      COUNT(DISTINCT session_id)::integer AS sessions,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total, 0), 1) AS percentage
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY browser
    ORDER BY sessions DESC
    LIMIT 6
  ) b;

  -- OS breakdown
  SELECT jsonb_agg(o) INTO v_os
  FROM (
    SELECT 
      COALESCE(os, 'Other') AS os,
      COUNT(DISTINCT session_id)::integer AS sessions,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total, 0), 1) AS percentage
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY os
    ORDER BY sessions DESC
    LIMIT 6
  ) o;

  RETURN jsonb_build_object(
    'devices', COALESCE(v_devices, '[]'::jsonb),
    'browsers', COALESCE(v_browsers, '[]'::jsonb),
    'os', COALESCE(v_os, '[]'::jsonb)
  );
END;
$$;

-- Geographic Breakdown (Countries and Argentine Provinces)
CREATE OR REPLACE FUNCTION public.get_web_analytics_geo(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_countries jsonb;
  v_provinces jsonb;
  v_total numeric;
  v_total_ar numeric;
BEGIN
  SELECT NULLIF(COUNT(1)::numeric, 0) INTO v_total
  FROM public.web_analytics_sessions
  WHERE started_at >= p_from
    AND started_at <= p_to
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false);

  SELECT NULLIF(COUNT(1)::numeric, 0) INTO v_total_ar
  FROM public.web_analytics_sessions
  WHERE started_at >= p_from
    AND started_at <= p_to
    AND country_code = 'AR'
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false);

  -- Countries
  SELECT jsonb_agg(c) INTO v_countries
  FROM (
    SELECT 
      COALESCE(country_code, 'UNKNOWN') AS country_code,
      COALESCE(country_name, 'Desconocido') AS country_name,
      COUNT(DISTINCT session_id)::integer AS sessions,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total, 0), 1) AS percentage
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY country_code, country_name
    ORDER BY sessions DESC
    LIMIT 10
  ) c;

  -- Argentina Provinces
  SELECT jsonb_agg(p) INTO v_provinces
  FROM (
    SELECT 
      COALESCE(region_code, 'UNKNOWN') AS region_code,
      COALESCE(region_name, 'Otras') AS region_name,
      COUNT(DISTINCT session_id)::integer AS sessions,
      COUNT(DISTINCT visitor_id)::integer AS visitors,
      ROUND(COALESCE(COUNT(DISTINCT session_id)::numeric * 100 / v_total_ar, 0), 1) AS percentage
    FROM public.web_analytics_sessions
    WHERE started_at >= p_from
      AND started_at <= p_to
      AND country_code = 'AR'
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY region_code, region_name
    ORDER BY sessions DESC
    LIMIT 10
  ) p;

  RETURN jsonb_build_object(
    'countries', COALESCE(v_countries, '[]'::jsonb),
    'provinces', COALESCE(v_provinces, '[]'::jsonb)
  );
END;
$$;

-- Realtime Intelligence: Active visitors in last N minutes with live pages, devices, regions
CREATE OR REPLACE FUNCTION public.get_web_analytics_realtime(
  p_window_minutes integer DEFAULT 5,
  p_env text DEFAULT 'production',
  p_exclude_internal boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_visitors integer;
  v_pages jsonb;
  v_devices jsonb;
  v_regions jsonb;
BEGIN
  -- Count active visitors
  SELECT COUNT(DISTINCT visitor_id)::integer INTO v_active_visitors
  FROM public.web_analytics_sessions
  WHERE last_seen_at >= (now() - (p_window_minutes || ' minutes')::interval)
    AND (p_env = 'all' OR environment = p_env)
    AND is_bot = false
    AND (NOT p_exclude_internal OR is_internal = false);

  -- Currently open pages
  SELECT jsonb_agg(pg) INTO v_pages
  FROM (
    SELECT 
      COALESCE(exit_path, landing_path, '/') AS path,
      COUNT(DISTINCT session_id)::integer AS active_users
    FROM public.web_analytics_sessions
    WHERE last_seen_at >= (now() - (p_window_minutes || ' minutes')::interval)
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY COALESCE(exit_path, landing_path, '/')
    ORDER BY active_users DESC
    LIMIT 10
  ) pg;

  -- Active devices
  SELECT jsonb_agg(dev) INTO v_devices
  FROM (
    SELECT 
      device_type,
      COUNT(DISTINCT session_id)::integer AS count
    FROM public.web_analytics_sessions
    WHERE last_seen_at >= (now() - (p_window_minutes || ' minutes')::interval)
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY device_type
    ORDER BY count DESC
  ) dev;

  -- Active regions/provinces
  SELECT jsonb_agg(reg) INTO v_regions
  FROM (
    SELECT 
      COALESCE(region_name, country_name, 'Desconocido') AS region,
      COUNT(DISTINCT session_id)::integer AS count
    FROM public.web_analytics_sessions
    WHERE last_seen_at >= (now() - (p_window_minutes || ' minutes')::interval)
      AND (p_env = 'all' OR environment = p_env)
      AND is_bot = false
      AND (NOT p_exclude_internal OR is_internal = false)
    GROUP BY COALESCE(region_name, country_name, 'Desconocido')
    ORDER BY count DESC
    LIMIT 8
  ) reg;

  RETURN jsonb_build_object(
    'active_visitors', COALESCE(v_active_visitors, 0),
    'pages', COALESCE(v_pages, '[]'::jsonb),
    'devices', COALESCE(v_devices, '[]'::jsonb),
    'regions', COALESCE(v_regions, '[]'::jsonb)
  );
END;
$$;
