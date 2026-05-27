"use client";

import { motion } from "framer-motion";

const benefits = [
  { metric: "+65%", label: "Tiempo Ahorrado", text: "Eliminá planillas manuales y tareas repetitivas." },
  { metric: "+18%", label: "Margen Neto", text: "Frená fugas impositivas y comisiones fantasmas." },
  { metric: "-40%", label: "Fallas de Stock", text: "Evitá penalizaciones de reputación y reclamos." },
  { metric: "24/7", label: "Auditoría Total", text: "Vigilancia constante, incluso mientras dormís." },
];

export function Benefits() {
  return (
    <section className="py-24 bg-indigo-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-indigo-500/30">
          {benefits.map((b, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="text-center px-4 space-y-1.5"
            >
              <div className="text-4xl md:text-6xl font-black text-white leading-none">
                {b.metric}
              </div>
              <div className="text-white font-bold text-sm md:text-base tracking-wide">
                {b.label}
              </div>
              <div className="text-indigo-100 font-medium text-xs leading-relaxed max-w-[180px] mx-auto opacity-90">
                {b.text}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
