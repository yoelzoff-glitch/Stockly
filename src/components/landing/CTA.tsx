"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

export function CTA() {
  return (
    <section className="relative py-24 bg-slate-950 text-white border-b border-slate-800 overflow-hidden bg-grid-pattern-dark">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-xs font-bold uppercase mb-6">
          <Sparkles className="w-3.5 h-3.5" /> INSTALACIÓN EN 3 MINUTOS
        </span>

        <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
          Dejá de perder dinero en comisiones invisibles.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-indigo-300">
            Tomá el control absoluto de tu rentable e-commerce.
          </span>
        </h2>

        <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed font-light">
          Vinculá tu cuenta oficial de Mercado Libre en menos de 3 minutos. Proba Klyvo gratis durante 15 días sin ingresar tarjeta de crédito.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-8 py-6 rounded-xl text-base shadow-xl shadow-amber-400/20 flex items-center justify-center gap-2">
              <span>Crear cuenta gratis ahora</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="https://calendly.com/klyvo-demo" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white border-slate-800 px-8 py-6 rounded-xl text-base font-semibold">
              Agendar demostración en vivo
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Conexión oficial OAuth 2.0 MeLi • Cancelá en cualquier momento</span>
        </div>
      </div>
    </section>
  );
}
