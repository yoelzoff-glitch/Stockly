"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { FadeUp } from "./motion";
import { trackCTAClick } from "@/lib/analytics/ga";

export function CTA() {
  return (
    <section className="relative py-20 md:py-28 bg-[#102A56] text-white overflow-hidden border-b border-[#0A1D3C]">
      {/* Subtle Brand Background Texture */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#FFFFFF 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Subtle accent glow */}
      <div
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#5B2FE4]/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-7">
        <FadeUp>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-semibold backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-[#F53B98]" />
            <span>Comenzá a operar con claridad hoy</span>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Tu operación ya genera los datos. <br className="hidden sm:inline" />
            <span className="text-white/90">LibretaX te ayuda a entenderlos.</span>
          </h2>
        </FadeUp>

        <FadeUp delay={0.15}>
          <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed font-normal">
            Conectá tu cuenta, cargá tus costos y empezá a conocer la rentabilidad real de tus ventas.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              onClick={() => trackCTAClick("cta_banner", "Probar LibretaX")}
              className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-[#102A56] bg-white hover:bg-[#F5F3EE] transition-all shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4]"
            >
              <span>Probar LibretaX</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/login"
              onClick={() => trackCTAClick("cta_banner", "Ingresar")}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
            >
              Ingresar
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.25}>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-white/70">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] shrink-0" />
              <span>15 días de prueba gratis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#198754] shrink-0" />
              <span>Conexión oficial Mercado Libre OAuth 2.0</span>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
