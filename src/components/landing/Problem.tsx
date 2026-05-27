"use client";

import { motion } from "framer-motion";
import { XCircle } from "lucide-react";

const problems = [
  {
    title: "Fugas Impositivas y Comisiones Invisibles",
    desc: "Las comisiones variables, cambios de campaña de Mercado Libre y retenciones impositivas se devoran tus ganancias reales sin que te des cuenta."
  },
  {
    title: "Esclavitud Operativa Diaria",
    desc: "Pasar de 3 a 5 horas al día editando títulos, precios y stock uno por uno en planillas desactualizadas, en lugar de planificar el crecimiento."
  },
  {
    title: "Penalizaciones por Quiebres de Stock",
    desc: "Pausar publicaciones por falta de stock o vender sin stock real en tu depósito físico destruye tu reputación y tu exposición frente a la competencia."
  },
  {
    title: "Títulos Fríos sin Palabras Clave SEO",
    desc: "Títulos duplicados, desactualizados o sin las palabras clave calientes que hunden tus publicaciones en el algoritmo de búsqueda de ML."
  },
  {
    title: "La Trampa de las Promociones a Ciegas",
    desc: "Activar promociones recomendadas por Mercado Libre sin saber tu costo real de reposición, lo que a menudo resulta en vender a pérdida."
  },
  {
    title: "Capital Atrapado en Productos Muertos",
    desc: "Productos con nulo movimiento que ocupan espacio físico y financiero en tu depósito, acumulando costos de almacenamiento y frenando tu caja."
  }
];

export function Problem() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
            El impuesto oculto de operar Mercado Libre a ciegas
          </h2>
          <p className="text-lg text-slate-600">
            El 90% de los vendedores operan usando planillas de Excel desactualizadas. Cuando las ventas suben, el caos operativo también sube, las comisiones invisibles se multiplican y tus ganancias reales desaparecen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {problems.map((problem, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start space-x-4 hover:shadow-md transition-shadow"
            >
              <div className="flex-shrink-0 mt-1">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-slate-950 font-bold text-base leading-snug">{problem.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{problem.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
