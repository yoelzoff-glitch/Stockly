"use client";

import { motion } from "framer-motion";

const benefits = [
  { metric: "+65%", text: "menos tiempo operativo" },
  { metric: "+18%", text: "mejora promedio de margen" },
  { metric: "-40%", text: "menos errores manuales" },
  { metric: "24/7", text: "IA operativa y atenta" },
];

export function Benefits() {
  return (
    <section className="py-24 bg-indigo-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-indigo-500/50">
          {benefits.map((b, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="text-center px-4"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-white mb-2">
                {b.metric}
              </div>
              <div className="text-indigo-100 font-medium">
                {b.text}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
