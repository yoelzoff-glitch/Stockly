"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { FadeUp } from "./motion";
import {
  LAUNCH_PROMOTION,
  isPromotionActive,
  calculatePromotionalPrice,
  CANONICAL_PLANS,
} from "@/lib/promotions/launchPromotion";
import { LaunchOfferBadge } from "@/components/marketing/LaunchOfferBadge";
import { LaunchCountdown } from "@/components/marketing/LaunchCountdown";
import {
  trackCTAClick,
  trackLaunchOfferView,
  trackLaunchOfferCTAClick,
} from "@/lib/analytics/ga";
import { trackWebEvent } from "@/components/analytics/WebAnalyticsTracker";

export function Pricing() {
  const [promoActive, setPromoActive] = useState(() => isPromotionActive());
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    const active = isPromotionActive();
    setPromoActive(active);

    if (active && !viewTrackedRef.current) {
      viewTrackedRef.current = true;
      trackLaunchOfferView("launch_2026", LAUNCH_PROMOTION.discountPercentage);
      trackWebEvent("offer_view", {
        promotion: "launch_2026",
        discount_percentage: LAUNCH_PROMOTION.discountPercentage,
      });
    }
  }, []);

  const handleExpire = () => {
    setPromoActive(false);
  };

  const handlePlanClick = (planName: string, ctaText: string) => {
    trackCTAClick(`pricing_${planName.toLowerCase()}`, ctaText);
    if (promoActive) {
      trackLaunchOfferCTAClick(planName.toLowerCase(), "launch_2026");
      trackWebEvent("offer_cta", {
        promotion: "launch_2026",
        plan: planName.toLowerCase(),
      });
    }
  };

  return (
    <section id="precios" className="py-20 md:py-28 border-b border-[rgba(0,57,104,0.10)] bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="max-w-3xl mb-12 sm:mb-16 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="w-2 h-2 rounded-sm bg-[#00DFDB]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#003968]">
                Planes y suscripción
              </span>
              {promoActive && (
                <LaunchOfferBadge text={`${LAUNCH_PROMOTION.discountPercentage}% OFF`} />
              )}
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#002B4D] tracking-tight">
              {promoActive
                ? LAUNCH_PROMOTION.headline
                : "Tarifas claras según el tamaño de tu catálogo."}
            </h2>

            <p className="text-base sm:text-lg text-[rgba(0,43,77,0.70)] leading-relaxed">
              {promoActive
                ? LAUNCH_PROMOTION.subheadline
                : "Todos los planes incluyen 15 días de prueba gratis sin tarjeta obligatoria. Facturación mensual en USD o equivalente en moneda local vía Mercado Pago."}
            </p>

            {promoActive && (
              <div className="pt-2">
                <LaunchCountdown onExpire={handleExpire} />
              </div>
            )}
          </div>
        </FadeUp>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {CANONICAL_PLANS.map((plan, idx) => {
            const priceInfo = calculatePromotionalPrice(
              plan.baseAmount,
              "USD",
              LAUNCH_PROMOTION.discountPercentage
            );

            return (
              <FadeUp key={plan.name} delay={0.1 + idx * 0.1}>
                <div
                  className={`relative h-full bg-white rounded-2xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 ${
                    plan.isPopular
                      ? "border-2 border-[#00DFDB] shadow-md shadow-[#00DFDB]/10"
                      : "border border-[rgba(0,57,104,0.12)] shadow-xs hover:border-[rgba(0,223,219,0.50)]"
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF984] text-[#002B4D] shadow-xs">
                        <Sparkles className="w-3 h-3 text-[#002B4D]" />
                        Recomendado
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="border-b border-[rgba(0,57,104,0.10)] pb-5 mb-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-[rgba(0,43,77,0.68)] uppercase tracking-wider block">
                          {plan.skuLimit}
                        </span>
                        {promoActive && (
                          <span className="text-[11px] font-bold text-[#002B4D] bg-[#FAF984] px-2 py-0.5 rounded-md border border-[#002B4D]/15">
                            {LAUNCH_PROMOTION.name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-bold text-[#002B4D] mt-1">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-[rgba(0,43,77,0.70)] mt-1.5 leading-relaxed">
                        {plan.description}
                      </p>

                      {/* Price Block */}
                      <div className="mt-5 space-y-1">
                        {promoActive && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm text-[rgba(0,43,77,0.40)] line-through font-semibold tabular-nums">
                              {priceInfo.normalPriceFormatted}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#002B4D] bg-[#FAF984] px-1.5 py-0.5 rounded">
                              -10%
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl sm:text-4xl font-extrabold text-[#002B4D] tabular-nums">
                            {promoActive
                              ? priceInfo.promoPriceFormatted
                              : priceInfo.normalPriceFormatted}
                          </span>
                          <span className="text-sm font-medium text-[rgba(0,43,77,0.68)]">
                            {plan.billingPeriod}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feat, fIdx) => (
                        <li
                          key={fIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-[#002B4D]"
                        >
                          <Check className="w-4 h-4 text-[#00DFDB] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href="/register"
                    onClick={() => handlePlanClick(plan.name, plan.ctaText)}
                    className={`w-full inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                      plan.isPopular
                        ? "text-white bg-[#003968] hover:bg-[#002B4D] shadow-xs"
                        : "text-[#003968] bg-white hover:bg-[rgba(0,223,219,0.08)] border border-[rgba(0,57,104,0.20)]"
                    }`}
                  >
                    {plan.ctaText}
                  </Link>
                </div>
              </FadeUp>
            );
          })}
        </div>

        {/* Footnote */}
        <FadeUp delay={0.25}>
          <p className="mt-8 text-xs text-[rgba(0,43,77,0.70)] text-center">
            {promoActive
              ? "Precios promocionales válidos durante el período de lanzamiento. Podés pausar o cambiar de plan en cualquier momento."
              : "Podés pausar o cambiar de plan en cualquier momento desde tu panel de facturación."}
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
