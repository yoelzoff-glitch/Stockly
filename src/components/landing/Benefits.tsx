"use client";

import { motion } from "framer-motion";
import { TrendingUp, Clock, ShieldAlert, Cpu } from "lucide-react";

const metrics = [
  { 
    metric: "+18.4%", 
    label: "Recuperación de Margen", 
    desc: "Identificación de comisiones incorrectas y retenciones.",
    color: "text-emerald-400"
  },
  { 
    metric: "+25hs", 
    label: "Ahorro Semanal de Equipo", 
    desc: "Eliminación de la edición manual de listas y planillas.",
    color: "text-amber-400"
  },
  { 
    metric: "0%", 
    label: "Riesgo de Vender a Pérdida", 
    desc: "Reglas automáticas de protección de margen mínimo.",
    color: "text-indigo-400"
  },
  { 
    metric: "< 60s", 
    label: "Respuesta en Sync MeLi", 
    desc: "Sincronización bidireccional instantánea de inventario.",
    color: "text-cyan-400"
  },
];

export function Benefits() {
  return (
    <section className="py-16 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((b, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2"
            >
              <div className={`text-4xl font-extrabold font-mono tracking-tight ${b.color}`}>
                {b.metric}
              </div>
              <h4 className="text-white font-bold text-sm">
                {b.label}
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed font-light">
                {b.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
