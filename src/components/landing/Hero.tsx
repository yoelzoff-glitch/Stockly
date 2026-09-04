import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SaleBreakdown } from "./SaleBreakdown";

export function Hero() {
  return (
    <section className="pt-32 pb-16 md:pt-36 md:pb-24 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Column: 45% (lg:col-span-5 or lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-[#101828] leading-[1.12] tracking-tight">
              Sabé cuánto te deja cada venta.
            </h1>

            <p className="text-lg text-[#5F6875] leading-relaxed font-normal max-w-xl">
              Klyvo reúne tus ventas, costos, comisiones, envíos, promociones, publicidad y stock de Mercado Libre para mostrarte la rentabilidad real de tu negocio.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shadow-xs"
              >
                <span>Probar Klyvo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="#como-funciona"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-lg text-sm font-semibold text-[#101828] bg-white hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors"
              >
                Conocer cómo funciona
              </Link>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs font-medium text-[#5F6875]">
              <ShieldCheck className="w-4 h-4 text-[#198754] shrink-0" />
              <span>Conexión segura mediante Mercado Libre OAuth.</span>
            </div>
          </div>

          {/* Right Column: 55% (lg:col-span-6 or col-span-7) */}
          <div className="lg:col-span-6 w-full">
            <SaleBreakdown />
          </div>

        </div>
      </div>
    </section>
  );
}
