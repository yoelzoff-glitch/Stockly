"use client";

import { motion } from "framer-motion";
import { XCircle } from "lucide-react";

const problems = [
  "No sabés cuánto ganás realmente",
  "Tenés stock desordenado",
  "Perdés tiempo ajustando publicaciones",
  "Títulos poco optimizados que pierden visitas",
  "No detectás productos muertos",
  "Las promociones te comen margen"
];

export function Problem() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Vender más no siempre significa ganar más
          </h2>
          <p className="text-lg text-slate-600">
            Escalar en Mercado Libre trae nuevos problemas. Si estás usando Excel o sistemas genéricos, probablemente estés perdiendo dinero sin saberlo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {problems.map((problem, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start space-x-4"
            >
              <div className="flex-shrink-0 mt-1">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-slate-800 font-medium">{problem}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
