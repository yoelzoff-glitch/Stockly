"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { 
  BarChart2, 
  Layers, 
  PackageCheck, 
  Bot, 
  Megaphone,
  Box,
  ShieldCheck
} from "lucide-react";

const modules = [
  {
    id: "ads",
    name: "MeLi Product ADS",
    icon: Megaphone,
    tagline: "Auditoría de ACOS, ROAS e Inversión Publicitaria",
    description: "Monitoreá el rendimiento de tus campañas de Mercado Libre Product ADS. Conocé tu ACOS real, el retorno de inversión por cada peso invertido y asegurate de que la publicidad no destruya el margen neto de tu producto.",
    preview: {
      metric: "7.4%",
      label: "ACOS Promedio Optimizado",
      highlight: "+13.5x ROAS de retorno en publicidad MeLi"
    }
  },
  {
    id: "full",
    name: "Stock MeLi FULL",
    icon: Box,
    tagline: "Control de Bodegas Fulfillment & Stock Crítico",
    description: "Audita las unidades físicas depositadas en las bodegas de Mercado Libre FULL. Recibí alertas tempranas de stock crítico antes de que se agoten tus publicaciones para enviar reposición a tiempo y no perder exposición.",
    preview: {
      metric: "4.820",
      label: "Unidades Auditadas en Bodega FULL",
      highlight: "Alertas automáticas de reposición preventiva"
    }
  },
  {
    id: "margins",
    name: "Margen Neto Limpio",
    icon: PackageCheck,
    tagline: "Conocé la ganancia neta exacta de cada SKU al centavo",
    description: "Descontamos comisiones variables por categoría, gastos de envíos Flex, retenciones de IIBB y tu costo de reposición. Sabrás qué publicaciones te generan caja real y cuáles te están costando plata.",
    preview: {
      metric: "28.4%",
      label: "Margen Limpio Promedio",
      highlight: "Deducciones impositivas auditadas automáticamente"
    }
  },
  {
    id: "sync",
    name: "Stock Físico & Combos",
    icon: Layers,
    tagline: "Combos e inventario unificados sin doble descuento",
    description: "Cargá tus insumos una sola vez. Cuando vendés un combo en MeLi, Klyvo descuenta automáticamente los componentes individuales de tu depósito real para mantener la sincronización perfecta.",
    preview: {
      metric: "0.2s",
      label: "Latencia de Sincronización MeLi",
      highlight: "Descuento automático de insumos por venta"
    }
  },
  {
    id: "copilot",
    name: "Asistente IA 24/7",
    icon: Bot,
    tagline: "Un copiloto financiero para tu equipo operativo",
    description: "Preguntale a Klyvo por WhatsApp cuánto gastaste hoy en Product ADS, cuántas unidades te quedan en MeLi Full o pedile que reajuste los títulos de tus productos menos vistos.",
    preview: {
      metric: "24/7",
      label: "Monitoreo Operativo Continuo",
      highlight: "Consultas por texto y notas de voz por WhatsApp"
    }
  }
];

export function Screenshots() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = modules[activeIdx];
  const IconComponent = current.icon;

  return (
    <section className="py-24 bg-slate-950 text-white border-b border-slate-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-2">
            [ KLYVO COMMAND CENTER ]
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Infraestructura de control para e-commerce
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            Explorá cómo se verán tus paneles de control para Mercado Libre Product ADS, bodegas FULL y finanzas netas.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {modules.map((mod, idx) => {
            const ModIcon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-mono font-bold transition-all border ${
                  activeIdx === idx
                    ? "bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-400/20"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                }`}
              >
                <ModIcon className="w-4 h-4" />
                <span>{mod.name}</span>
              </button>
            );
          })}
        </div>

        {/* Module Content Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto bg-slate-900 rounded-3xl border border-slate-800 p-8 md:p-12 shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                <IconComponent className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  MÓDULO #{activeIdx + 1}
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-white">{current.name}</h3>
              </div>
            </div>

            <h4 className="text-2xl md:text-3xl font-extrabold text-amber-400 mb-4 tracking-tight">
              "{current.tagline}"
            </h4>

            <p className="text-slate-300 text-base leading-relaxed mb-8 font-light">
              {current.description}
            </p>

            {/* Micro Metric Banner */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div>
                <span className="text-3xl md:text-4xl font-extrabold text-emerald-400 font-mono block">
                  {current.preview.metric}
                </span>
                <span className="text-xs text-slate-400 font-mono mt-1 block">
                  {current.preview.label}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-200 bg-slate-900 p-3 rounded-xl border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{current.preview.highlight}</span>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
