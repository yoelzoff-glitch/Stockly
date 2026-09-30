// src/components/landing/ProfitabilityCalculatorSection.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, TrendingUp, Sparkles, Percent, DollarSign } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics/ga";

export function ProfitabilityCalculatorSection() {
  return (
    <section className="py-20 lg:py-24 bg-[#FFFFFF] border-t border-[rgba(0,57,104,0.08)] relative overflow-hidden" id="calculadora-section">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(0,57,104,0.05)] border border-[rgba(0,57,104,0.12)] text-xs font-bold text-[#003968]">
              <Calculator className="w-3.5 h-3.5 text-[#00DFDB]" />
              <span>Herramienta gratuita para sellers</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#002B4D] leading-tight">
              ¿Cuánto te queda realmente de una venta?
            </h2>

            <p className="text-base sm:text-lg text-[rgba(0,43,77,0.75)] leading-relaxed">
              Simulá una publicación antes de comprar stock o publicar en Mercado Libre. Ingresá tu costo y precio de venta para estimar comisiones oficiales, costo de envío, publicidad y margen neto exacto.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2.5 text-sm text-[#002B4D]">
                <CheckCircle2 className="w-4 h-4 text-[#00DFDB] shrink-0" />
                <span>Comisiones oficiales de Mercado Libre Clásica y Premium</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#002B4D]">
                <CheckCircle2 className="w-4 h-4 text-[#00DFDB] shrink-0" />
                <span>Desglose de Mercado Envíos y bonificación según rango de precio</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#002B4D]">
                <CheckCircle2 className="w-4 h-4 text-[#00DFDB] shrink-0" />
                <span>Simulación inversa: calculá el precio ideal para tu margen objetivo</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/calculadora-rentabilidad"
                onClick={() => trackCTAClick("landing_section", "Calcular mi rentabilidad")}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#003968] hover:bg-[#002B4D] transition-all shadow-xs hover:shadow-sm"
              >
                <span>Calcular mi rentabilidad</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <span className="text-xs text-[rgba(0,43,77,0.60)] text-center sm:text-left">
                100% online y sin registro previo.
              </span>
            </div>
          </div>

          {/* Right Preview Mockup Card */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto max-w-lg bg-[#F5F3EE] p-5 sm:p-7 rounded-3xl border border-[rgba(0,57,104,0.12)] shadow-xl shadow-[rgba(0,43,77,0.06)]">
              {/* Mini simulation card mockup */}
              <div className="bg-white rounded-2xl p-5 border border-[rgba(0,57,104,0.08)] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[rgba(0,57,104,0.06)] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00DFDB]" />
                    <span className="text-xs font-bold text-[#002B4D]">Ejemplo de Simulación en Vivo</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Margen positivo
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#F5F3EE] rounded-xl border border-[rgba(0,57,104,0.06)]">
                    <span className="text-[10px] uppercase font-bold text-[rgba(0,43,77,0.50)] block">
                      Precio de lista
                    </span>
                    <span className="text-base font-extrabold text-[#002B4D] mt-0.5 block">$ 35.000</span>
                  </div>
                  <div className="p-3 bg-[#F5F3EE] rounded-xl border border-[rgba(0,57,104,0.06)]">
                    <span className="text-[10px] uppercase font-bold text-[rgba(0,43,77,0.50)] block">
                      Costo proveedor
                    </span>
                    <span className="text-base font-extrabold text-[#002B4D] mt-0.5 block">$ 15.000</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-[#002B4D] to-[#003968] text-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80 font-medium">Ganancia neta estimada:</span>
                    <span className="text-lg font-black text-[#00DFDB]">+$ 8.950</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                    <span className="text-white/80 font-medium">Margen sobre venta:</span>
                    <span className="font-bold text-[#FAF984]">25,6 %</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/80 font-medium">Retorno sobre costo (ROI):</span>
                    <span className="font-bold text-white">+59,7 %</span>
                  </div>
                </div>

                <Link
                  href="/calculadora-rentabilidad"
                  onClick={() => trackCTAClick("landing_preview_card", "Abrir calculadora completa")}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-[#003968] bg-[rgba(0,57,104,0.05)] hover:bg-[rgba(0,57,104,0.10)] border border-[rgba(0,57,104,0.12)] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Abrir calculadora interactiva</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Decorative accent */}
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#00DFDB] flex items-center justify-center shadow-md">
                <Sparkles className="w-4 h-4 text-[#002B4D]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
