import { NextRequest, NextResponse } from "next/server";
import { resolveVisitorGeo } from "@/lib/analytics/geo";
import { parseUserAgent } from "@/lib/analytics/userAgent";
import { checkAnalyticsRateLimit, getClientFingerprint } from "@/lib/analytics/rateLimiter";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

const ALLOWED_TYPES = new Set(["page_view", "heartbeat", "event"]);
const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_clicked",
  "pricing_viewed",
  "login_clicked",
  "signup_clicked",
  "demo_clicked",
  "contact_clicked",
  "whatsapp_clicked",
  "signup_completed",
]);

interface AnalyticsPayload {
  type: "page_view" | "heartbeat" | "event";
  sessionId: string;
  visitorId: string;
  path: string;
  title?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  eventName?: string;
  metadata?: Record<string, any>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const payload = rawBody as AnalyticsPayload;

    // 1. Strict validation
    if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
      return NextResponse.json({ error: "Invalid or unsupported event type" }, { status: 400 });
    }

    if (!payload.sessionId || typeof payload.sessionId !== "string" || payload.sessionId.length < 8 || payload.sessionId.length > 64) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    if (!payload.visitorId || typeof payload.visitorId !== "string" || payload.visitorId.length < 8 || payload.visitorId.length > 64) {
      return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 });
    }

    if (!payload.path || typeof payload.path !== "string" || payload.path.length > 500) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (payload.type === "event" && payload.eventName && !ALLOWED_EVENTS.has(payload.eventName)) {
      return NextResponse.json({ error: "Disallowed eventName" }, { status: 400 });
    }

    // 2. Rate limiting check
    const fingerprint = getClientFingerprint(req, payload.visitorId);
    if (!checkAnalyticsRateLimit(fingerprint)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 3. Server-side resolution
    const geo = resolveVisitorGeo(req);
    const ua = parseUserAgent(req.headers.get("user-agent"));
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";

    // Internal traffic exclusion check
    const internalCookie = req.cookies.get("lx_internal")?.value;
    const isInternal = internalCookie === "1" || req.headers.get("x-libretax-internal") === "1";

    // Parse referrer domain
    let referrerDomain: string | null = null;
    if (payload.referrer && typeof payload.referrer === "string") {
      try {
        referrerDomain = new URL(payload.referrer).hostname.replace(/^www\./, "");
      } catch {
        referrerDomain = payload.referrer.slice(0, 100);
      }
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // 4. Session management
    const { data: existingSession } = await supabase
      .from("web_analytics_sessions")
      .select("id, last_seen_at, duration_seconds, pageviews")
      .eq("session_id", payload.sessionId)
      .maybeSingle();

    if (!existingSession) {
      // Create new session
      await supabase.from("web_analytics_sessions").insert({
        session_id: payload.sessionId,
        visitor_id: payload.visitorId,
        started_at: now,
        last_seen_at: now,
        landing_path: payload.path,
        exit_path: payload.path,
        referrer: payload.referrer || null,
        referrer_domain: referrerDomain,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        utm_content: payload.utm_content || null,
        utm_term: payload.utm_term || null,
        country_code: geo.countryCode,
        country_name: geo.countryName,
        region_code: geo.regionCode,
        region_name: geo.regionName,
        city: geo.city,
        device_type: ua.deviceType,
        os: ua.os,
        browser: ua.browser,
        pageviews: payload.type === "page_view" ? 1 : 0,
        duration_seconds: 0,
        is_bot: ua.isBot,
        environment,
        is_internal: isInternal,
      });
    } else {
      // Update existing session
      const lastSeen = new Date(existingSession.last_seen_at).getTime();
      const elapsedSeconds = Math.min(Math.max(Math.round((Date.now() - lastSeen) / 1000), 0), 120);

      const updates: Record<string, any> = {
        last_seen_at: now,
        exit_path: payload.path,
        updated_at: now,
      };

      if (payload.type === "heartbeat" || payload.type === "page_view") {
        updates.duration_seconds = (existingSession.duration_seconds || 0) + elapsedSeconds;
      }

      if (payload.type === "page_view") {
        updates.pageviews = (existingSession.pageviews || 0) + 1;
      }

      await supabase
        .from("web_analytics_sessions")
        .update(updates)
        .eq("id", existingSession.id);
    }

    // 5. Ingest Pageview or Event
    if (payload.type === "page_view") {
      await supabase.from("web_analytics_pageviews").insert({
        session_id: payload.sessionId,
        visitor_id: payload.visitorId,
        path: payload.path,
        page_title: payload.title?.slice(0, 255) || null,
        referrer: payload.referrer?.slice(0, 1000) || null,
        occurred_at: now,
        duration_seconds: 0,
        country_code: geo.countryCode,
        region_code: geo.regionCode,
        device_type: ua.deviceType,
        is_bot: ua.isBot,
        environment,
        is_internal: isInternal,
      });
    } else if (payload.type === "event" && payload.eventName) {
      await supabase.from("web_analytics_events").insert({
        session_id: payload.sessionId,
        visitor_id: payload.visitorId,
        event_name: payload.eventName,
        path: payload.path,
        metadata: payload.metadata || {},
        occurred_at: now,
        is_bot: ua.isBot,
        environment,
        is_internal: isInternal,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    logger.warn({
      event: "ANALYTICS_COLLECTION_ERROR",
      error: error?.message,
    });
    return NextResponse.json({ ok: true }); // Fail-silent for client telemetry
  }
}
