"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, ArrowRight, DollarSign, Clock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function RoiCalculator() {
  // Monthly billing volume in ARS millions
  const [volume, setVolume] = useState<number>(15);

  // Estimations
  const feeRecoveryPct = 0.095; // ~9.5% average lost margin recovered
  const monthlySavingsARS = Math.round(volume * 1000000 * feeRecoveryPct);
  const hoursSavedPerWeek = Math.min(45, Math.round(12 + volume * 0.8));

  // Format currency
  const formatARS = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <section id="calculadora" className="py-24 bg-slate-900 text-white border-b border-slate-800 bg-grid-pattern-dark relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-amber-400/10 border border-amber-400/30 text-amber-400 mb-4">
            <Calculator className="w-3.5 h-3.5" />
            SIMULADOR INTERACTIVO DE RETORNO
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            ¿Cuánto dinero estás perdiendo por no auditar tus ventas?
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            Desplazá la barra según tu volumen actual de facturación mensual en Mercado Libre y descubrí cuánto capital podés recuperar este mes.
          </p>
        </div>

        {/* Interactive Calculator Card */}
        <div className="max-w-4xl mx-auto bg-slate-950 rounded-3xl border border-slate-800 p-8 md:p-12 shadow-2xl">
          
          <div className="space-y-8">
            
            {/* Slider Controls */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-mono text-slate-300 uppercase tracking-wider font-semibold">
                  Tu facturación mensual en Mercado Libre:
                </label>
                <span className="text-2xl font-extrabold text-amber-400 font-mono">
                  $ {volume}.000.000 ARS
                </span>
              </div>

              <input 
                type="range" 
                min={3} 
                max={80} 
                step={1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 transition-all"
              />

              <div className="flex justify-between text-xs font-mono text-slate-500 mt-2">
                <span>$ 3M ARS/mes</span>
                <span>$ 40M ARS/mes</span>
                <span>+ $ 80M ARS/mes</span>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800">
              
              {/* Savings Box */}
              <div className="bg-slate-900/90 p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/10">
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-2">
                  <DollarSign className="w-4 h-4" /> Capital Recuperable Estimado / Mes
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-emerald-400 font-mono">
                  {formatARS(monthlySavingsARS)}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Basado en detección de comisiones mal cobradas, corrección de publicaciones a pérdida y retenciones impositivas recuperables.
                </p>
              </div>

              {/* Time Box */}
              <div className="bg-slate-900/90 p-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/10">
                <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase mb-2">
                  <Clock className="w-4 h-4" /> Tiempo Operativo Ahorrado
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-indigo-300 font-mono">
                  +{hoursSavedPerWeek} Horas / Semanal
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Ahorro directo en actualización de listas de precios, pausa de stockouts y edición masiva de títulos.
                </p>
              </div>

            </div>

            {/* Bottom CTA Banner inside Calculator */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ROI estimado superior a 20x el costo del plan Klyvo Pro</span>
              </div>

              <Link href="/register" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-6 py-5 rounded-xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Empezar a recuperar dinero</span>
                </Button>
              </Link>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
