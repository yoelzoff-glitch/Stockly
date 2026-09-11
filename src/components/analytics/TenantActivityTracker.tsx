"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INTERACTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function TenantActivityTracker() {
  const pathname = usePathname();
  const lastInteractionTimeRef = useRef<number>(Date.now());
  const lastTrackedPathRef = useRef<string>("");

  // Map route to functional event name
  const getEventNameForPath = (path: string): string | null => {
    if (path === "/dashboard") return "dashboard_viewed";
    if (path.startsWith("/dashboard/sales")) return "orders_viewed";
    if (path.startsWith("/dashboard/products")) return "products_viewed";
    if (path.startsWith("/dashboard/finance") || path.startsWith("/dashboard/accounting")) {
      return "profitability_viewed";
    }
    if (path.startsWith("/dashboard/ads")) return "ads_viewed";
    if (path.startsWith("/dashboard/settings")) return "settings_viewed";
    return null;
  };

  const sendActivity = async (eventName: string, metadata: Record<string, any> = {}) => {
    try {
      await fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, metadata }),
      });
    } catch {
      // Silent failure on activity tracking to not disrupt UX
    }
  };

  // 1. Listen for real human interaction events
  useEffect(() => {
    const handleInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });
    window.addEventListener("click", handleInteraction, { passive: true });
    window.addEventListener("scroll", handleInteraction, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
    };
  }, []);

  // 2. Track functional page navigation (throttled by path change)
  useEffect(() => {
    if (!pathname || pathname === lastTrackedPathRef.current) return;
    lastTrackedPathRef.current = pathname;

    const eventName = getEventNameForPath(pathname);
    if (eventName) {
      sendActivity(eventName, { path: pathname });
    }
  }, [pathname]);

  // 3. Heartbeat interval for active visible sessions
  useEffect(() => {
    const interval = setInterval(() => {
      // Must be visible tab
      if (document.visibilityState !== "visible") return;

      // Must have had recent interaction
      const now = Date.now();
      const elapsedSinceInteraction = now - lastInteractionTimeRef.current;
      if (elapsedSinceInteraction > INTERACTION_TIMEOUT_MS) return;

      sendActivity("heartbeat", { path: pathname });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pathname]);

  return null;
}
