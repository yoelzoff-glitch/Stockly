"use client";

import { sendGAEvent } from "@next/third-parties/google";

/**
 * Dispatches a safe GA4 event, ensuring no PII or sensitive data is included.
 * Operates safely during SSR and avoid throwing exceptions if GA is blocked by client adblockers.
 */
export function trackGAEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === "undefined") return;

  try {
    // Sanitize params: strictly filter out any potential PII or confidential fields
    const safeParams: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (
        /email|token|password|secret|cost|price|revenue|amount|tenant|user_id|dni|phone|credential|name|company/i.test(
          k
        )
      ) {
        continue;
      }
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        safeParams[k] = v;
      }
    }

    sendGAEvent("event", eventName, safeParams);
  } catch (err) {
    // Silently continue if analytics script is blocked or unavailable
    console.debug("[GA4] Tracking exception:", err);
  }
}

/**
 * Standardized GA4 Conversion & Engagement Events
 */

export function trackCTAClick(ctaLocation: string, ctaText: string) {
  trackGAEvent("cta_click", {
    cta_location: ctaLocation,
    cta_text: ctaText,
  });
}

export function trackSignUp(method: string = "email") {
  trackGAEvent("sign_up", {
    method,
  });
}

export function trackLogin(method: string = "email") {
  trackGAEvent("login", {
    method,
  });
}

export function trackStartOnboarding(step: string = "business_profile") {
  trackGAEvent("start_onboarding", {
    step,
  });
}

export function trackCompleteOnboarding() {
  trackGAEvent("complete_onboarding");
}

export function trackConnectMercadoLibre() {
  trackGAEvent("connect_mercadolibre");
}

export function trackLeadPopupView(source: string = "landing_popup") {
  trackGAEvent("lead_popup_view", { source });
}

export function trackLeadPopupDismiss(source: string = "landing_popup") {
  trackGAEvent("lead_popup_dismiss", { source });
}

export function trackLeadPopupOptionSelected(option: "meeting" | "contact") {
  trackGAEvent("lead_popup_option_selected", { option });
}

export function trackGenerateLead(leadType: "meeting" | "contact", source: string = "landing_popup") {
  trackGAEvent("generate_lead", {
    lead_type: leadType,
    source,
  });
}

export function trackLaunchOfferView(
  promotion: string = "launch_2026",
  discountPercentage: number = 10
) {
  trackGAEvent("launch_offer_view", {
    promotion,
    discount_percentage: discountPercentage,
  });
}

export function trackLaunchOfferCTAClick(planName: string, promotion: string = "launch_2026") {
  trackGAEvent("launch_offer_cta_click", {
    promotion,
    plan: planName,
  });
}

export function trackLaunchOfferConversion(planName: string, promotion: string = "launch_2026") {
  trackGAEvent("launch_offer_conversion", {
    promotion,
    plan: planName,
  });
}


