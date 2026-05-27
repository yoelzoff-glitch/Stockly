"use client";

import { motion } from "framer-motion";
import { Bot, Package, CircleDollarSign, Tag, BarChart3, MessageSquare, Sparkles, RefreshCw } from "lucide-react";

const solutions = [
  {
    icon: <Bot className="w-6 h-6 text-indigo-600" />,
    title: "Agente IA 24/7",
    description: "Ejecutá acciones masivas usando lenguaje natural o notas de voz. Decile: 'Subime 5% a la categoría Bazar' y mirá cómo ocurre al instante.",
    color: "bg-indigo-50 border-indigo-100"
  },
  {
    icon: <CircleDollarSign className="w-6 h-6 text-blue-600" />,
    title: "Auditoría de Margen Real",
    description: "Calculá tu rentabilidad neta exacta en tiempo real, descontando al centavo comisiones de ML, retenciones, cargos de envío y costo del producto.",
    color: "bg-blue-50 border-blue-100"
  },
  {
    icon: <RefreshCw className="w-6 h-6 text-cyan-600" />,
    title: "Sincronizador de 'Hermanas'",
    description: "Editá títulos, stock y precios en publicaciones Clásica y Premium asociadas al mismo SKU en un solo clic. Ahorrá horas de trabajo repetitivo.",
    color: "bg-cyan-50 border-cyan-100"
  },
  {
    icon: <Sparkles className="w-6 h-6 text-violet-600" />,
    title: "Copiloto SEO de Títulos",
    description: "Nuestra IA analiza tus publicaciones y genera sugerencias SEO optimizadas basadas en datos calientes para disparar tus visitas y conversiones.",
    color: "bg-violet-50 border-violet-100"
  },
  {
    icon: <Package className="w-6 h-6 text-emerald-600" />,
    title: "Stock Físico Inteligente",
    description: "Administrá de forma independiente el stock de tu depósito físico y Mercado Libre. Automatizá alertas de quiebre y evitá penalizaciones.",
    color: "bg-emerald-50 border-emerald-100"
  },
  {
    icon: <Tag className="w-6 h-6 text-orange-600" />,
    title: "Optimizador de Promociones",
    description: "Evaluá instantáneamente qué campañas, descuentos y cupones te convienen y cuáles destruyen tu rentabilidad antes de que sea tarde.",
    color: "bg-orange-50 border-orange-100"
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-pink-600" />,
    title: "WhatsApp Command Center",
    description: "Operá todo tu catálogo de Mercado Libre enviando un simple mensaje de WhatsApp. Cambiar precios o pausar stock nunca fue tan rápido.",
    color: "bg-pink-50 border-pink-100"
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-purple-600" />,
    title: "Radar de Fugas Operativas",
    description: "Stockly vigila constantemente tus productos de bajo margen, quiebres de stock inminentes o comisiones erróneas y te avisa para actuar.",
    color: "bg-purple-50 border-purple-100"
  }
];

export function Solution() {
  return (
    <section id="solucion" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
            Stockly hace el trabajo de un equipo de 5 personas
          </h2>
          <p className="text-lg text-slate-600">
            La primera suite operativa con Inteligencia Artificial diseñada exclusivamente para automatizar, controlar y escalar tus cuentas de Mercado Libre en piloto automático.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {solutions.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className={`p-8 rounded-3xl border ${item.color} transition-shadow hover:shadow-md flex flex-col justify-between`}
            >
              <div>
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 shrink-0">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">{item.title}</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
