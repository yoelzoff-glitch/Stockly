"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SaleBreakdown } from "./SaleBreakdown";
import { FadeUp, ScaleIn } from "./motion";
import { trackCTAClick } from "@/lib/analytics/ga";

export function Hero() {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[rgba(0,57,104,0.10)] bg-white overflow-hidden">
      {/* Subtle brand grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#003968 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6">
            <FadeUp delay={0.05}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[rgba(0,57,104,0.12)] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#00DFDB] animate-pulse" />
                <span className="text-xs font-semibold text-[#003968] tracking-wide">
                  Gestión y rentabilidad para Mercado Libre
                </span>
              </div>
            </FadeUp>

            <FadeUp delay={0.12}>
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#002B4D] leading-[1.1] tracking-tight">
                Sabé cuánto te deja <br className="hidden sm:inline" />
                <span className="relative inline-block">
                  cada venta.
                  <span
                    className="absolute -bottom-1 left-0 right-0 h-1 bg-[#00DFDB] rounded-full"
                    aria-hidden="true"
                  />
                </span>
              </h1>
            </FadeUp>

            <FadeUp delay={0.18}>
              <p className="text-base sm:text-lg text-[rgba(0,43,77,0.70)] leading-relaxed font-normal max-w-xl">
                LibretaX reúne tus ventas, costos, comisiones, envíos, promociones, publicidad y stock de Mercado Libre para mostrarte la rentabilidad real de tu negocio.
              </p>
            </FadeUp>

            <FadeUp delay={0.24}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  href="/register"
                  onClick={() => trackCTAClick("hero", "Probar LibretaX")}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#003968] hover:bg-[#002B4D] transition-all shadow-sm hover:shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB]"
                >
                  <span>Probar LibretaX</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>

                <Link
                  href="#como-funciona"
                  onClick={() => trackCTAClick("hero", "Conocer cómo funciona")}
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-semibold text-[#003968] bg-white hover:bg-[rgba(0,223,219,0.08)] border border-[rgba(0,57,104,0.20)] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB]"
                >
                  Conocer cómo funciona
                </Link>
              </div>
            </FadeUp>

            <FadeUp delay={0.3}>
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-[rgba(0,43,77,0.70)]">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-[#00DFDB] shrink-0" />
                  <span>Conexión oficial OAuth 2.0</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#00DFDB] shrink-0" />
                  <span>15 días de prueba gratis</span>
                </div>
              </div>
            </FadeUp>
          </div>

          {/* Right Column: Interactive Sale Breakdown */}
          <div className="lg:col-span-6 w-full">
            <ScaleIn delay={0.2} duration={0.6}>
              <SaleBreakdown />
            </ScaleIn>
          </div>
        </div>
      </div>
    </section>
  );
}
