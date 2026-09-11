"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_COOKIE = "lx_vid";
const SESSION_COOKIE = "lx_sid";
const LAST_ACTIVE_KEY = "lx_last_active";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let vid = localStorage.getItem(VISITOR_COOKIE) || getCookie(VISITOR_COOKIE);
  if (!vid) {
    vid = generateId();
    localStorage.setItem(VISITOR_COOKIE, vid);
  }
  setCookie(VISITOR_COOKIE, vid, 365);
  return vid;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const now = Date.now();
  const lastActiveStr = localStorage.getItem(LAST_ACTIVE_KEY);
  const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;

  let sid = sessionStorage.getItem(SESSION_COOKIE) || getCookie(SESSION_COOKIE);

  // Expired or new session
  if (!sid || now - lastActive > SESSION_TIMEOUT_MS) {
    sid = generateId();
    sessionStorage.setItem(SESSION_COOKIE, sid);
  }

  localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
  setCookie(SESSION_COOKIE, sid, 1);
  return sid;
}

/**
 * Public helper to track custom interactions (CTAs, demo clicks, etc.)
 */
export function trackWebEvent(eventName: string, metadata?: Record<string, any>): void {
  if (typeof window === "undefined") return;

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const path = window.location.pathname;

  fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      type: "event",
      sessionId,
      visitorId,
      eventName,
      path,
      metadata: metadata || {},
    }),
  }).catch(() => {});
}

function TrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<{ path: string; time: number } | null>(null);

  useEffect(() => {
    // 1. Strictly ignore internal dashboard or administrative routes
    if (!pathname || pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin") || pathname.startsWith("/api")) {
      return;
    }

    const now = Date.now();
    const currentPath = pathname;

    // Deduplicate against React Strict Mode & double-renders (<1500ms same path)
    if (
      lastTrackedRef.current &&
      lastTrackedRef.current.path === currentPath &&
      now - lastTrackedRef.current.time < 1500
    ) {
      return;
    }

    lastTrackedRef.current = { path: currentPath, time: now };

    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();

    // Extract UTM parameters
    const utmSource = searchParams?.get("utm_source") || undefined;
    const utmMedium = searchParams?.get("utm_medium") || undefined;
    const utmCampaign = searchParams?.get("utm_campaign") || undefined;
    const utmContent = searchParams?.get("utm_content") || undefined;
    const utmTerm = searchParams?.get("utm_term") || undefined;

    // Send pageview
    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type: "page_view",
        sessionId,
        visitorId,
        path: currentPath,
        title: document.title || "LibretaX",
        referrer: document.referrer || "",
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_content: utmContent,
        utm_term: utmTerm,
      }),
    }).catch(() => {});

    // Heartbeat setup
    let heartbeatTimer: NodeJS.Timeout | null = null;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;

      const currentSessionId = getOrCreateSessionId();
      fetch("/api/analytics/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "heartbeat",
          sessionId: currentSessionId,
          visitorId,
          path: currentPath,
        }),
      }).catch(() => {});
    };

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
        startHeartbeat();
      } else {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      }
    };

    startHeartbeat();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, searchParams]);

  return null;
}

export function WebAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  );
}
