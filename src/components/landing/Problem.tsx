"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, ShieldAlert, ArrowRight, TrendingUp } from "lucide-react";

export function Problem() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const comparisons = [
    {
      topic: "Cálculo de Margen Limpio",
      oldWay: "Calculás el margen a ojo o con un Excel estático. Las retenciones de IIBB y cambios de comisión de MeLi te devoran el 8-15% de la ganancia real.",
      klyvoWay: "Auditoría en tiempo real. Klyvo desglosa retenciones impositivas, costo de reposición y comisiones por categoría al centavo.",
      impact: "+14.5% Recuperación de margen"
    },
    {
      topic: "Gestión de Stock y Depósito",
      oldWay: "Quiebres de stock continuos por ventas paralelas. Tenés que pausar publicaciones manualmente en Mercado Libre arriesgando tu reputación.",
      klyvoWay: "Sincronización bidireccional inmediata entre tu depósito físico y Mercado Libre. Reserva automática de stock al vender.",
      impact: "0 Pausas por stockout"
    },
    {
      topic: "Estrategia de Precios (Repricing)",
      oldWay: "Cambiar precios uno por uno lleva horas. Si el dólar sube o tu proveedor cambia la lista, vendés a pérdida durante días.",
      klyvoWay: "Reglas dinámicas de repricing automático basadas en costo de reposición, stock remanente y margen mínimo garantizado.",
      impact: "Ajustes en < 60 segundos"
    },
    {
      topic: "SEO y Títulos de Publicaciones",
      oldWay: "Títulos fríos y genéricos copiados del proveedor. Sin optimización por palabras clave de búsqueda estacional en MeLi.",
      klyvoWay: "Motor de IA que audita la exposición de tu catálogo y reescribe los títulos con los términos con mayor volumen de búsqueda actual.",
      impact: "+40% Exposición orgánica"
    },
    {
      topic: "Promociones y Descuentos",
      oldWay: "Aceptás ofertas sugeridas por Mercado Libre a ciegas sin conocer la absorción real de costos, reduciendo el margen a cero.",
      klyvoWay: "Simulador pre-campaña que te indica exactamente qué productos conviene sumar a cada promoción de MeLi y cuáles descartar.",
      impact: "Ventas 100% rentables"
    }
  ];

  return (
    <section id="matriz-comparativa" className="py-24 bg-slate-900 text-white border-b border-slate-800 bg-grid-pattern-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
            <ShieldAlert className="w-3.5 h-3.5" />
            EL IMPUESTO OCULTO DE OPERAR A CIEGAS
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Excel manual vs. <span className="text-amber-400">Inteligencia Operativa Klyvo</span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            Cuando tus ventas suben en Mercado Libre, la complejidad operativa se multiplica. Mirá la diferencia entre gestionar a oscuras o tener un copiloto financiero 24/7.
          </p>
        </div>

        {/* Matrix Container */}
        <div className="max-w-5xl mx-auto rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          
          {/* Matrix Header Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-900 p-4 border-b border-slate-800 text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
            <div className="md:col-span-3">Área de Operación</div>
            <div className="md:col-span-4 text-red-400 flex items-center gap-1 mt-2 md:mt-0">
              <X className="w-4 h-4" /> La Forma Tradicional (Excel)
            </div>
            <div className="md:col-span-5 text-emerald-400 flex items-center gap-1 mt-2 md:mt-0">
              <Check className="w-4 h-4" /> Con Klyvo Copilot
            </div>
          </div>

          {/* Matrix Body Rows */}
          <div className="divide-y divide-slate-800/80">
            {comparisons.map((item, idx) => (
              <motion.div
                key={idx}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`grid grid-cols-1 md:grid-cols-12 p-5 gap-4 transition-colors items-center ${
                  hoveredRow === idx ? "bg-slate-900/90" : "bg-slate-950/60"
                }`}
              >
                {/* Topic */}
                <div className="md:col-span-3">
                  <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1">
                    #{idx + 1}
                  </span>
                  <h4 className="text-white font-bold text-sm leading-tight">{item.topic}</h4>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                    {item.impact}
                  </span>
                </div>

                {/* Old Way */}
                <div className="md:col-span-4 bg-red-950/10 p-3.5 rounded-xl border border-red-500/20 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1 font-mono">
                    <X className="w-3.5 h-3.5" /> Pérdida Operativa
                  </div>
                  {item.oldWay}
                </div>

                {/* Klyvo Way */}
                <div className="md:col-span-5 bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/30 text-xs text-slate-200 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1 font-mono">
                    <Check className="w-3.5 h-3.5" /> Automatizado Klyvo
                  </div>
                  {item.klyvoWay}
                </div>
              </motion.div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
