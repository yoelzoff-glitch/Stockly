"use client";

import { motion } from "framer-motion";
import { Bot, Package, CircleDollarSign, Tag, BarChart3, MessageSquare, Sparkles, RefreshCw } from "lucide-react";

const solutions = [
  {
    icon: <Bot className="w-6 h-6 text-indigo-600" />,
    title: "IA Operativa",
    description: "\"Decile: Subime 5% los productos con C144\"",
    color: "bg-indigo-50 border-indigo-100"
  },
  {
    icon: <Package className="w-6 h-6 text-emerald-600" />,
    title: "Stock inteligente",
    description: "\"Separá depósito y Mercado Libre\"",
    color: "bg-emerald-50 border-emerald-100"
  },
  {
    icon: <CircleDollarSign className="w-6 h-6 text-blue-600" />,
    title: "Rentabilidad real",
    description: "\"Calcula comisiones, impuestos y costos\"",
    color: "bg-blue-50 border-blue-100"
  },
  {
    icon: <Sparkles className="w-6 h-6 text-violet-600" />,
    title: "Títulos con IA",
    description: "\"Optimizá títulos SEO en base a tus datos para vender más\"",
    color: "bg-violet-50 border-violet-100"
  },
  {
    icon: <RefreshCw className="w-6 h-6 text-cyan-600" />,
    title: "Sincronización de hermanos",
    description: "\"Editá títulos y stock en Clásica y Premium con el mismo SKU a la vez\"",
    color: "bg-cyan-50 border-cyan-100"
  },
  {
    icon: <Tag className="w-6 h-6 text-orange-600" />,
    title: "Promociones automáticas",
    description: "\"Crea ofertas y cupones\"",
    color: "bg-orange-50 border-orange-100"
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-purple-600" />,
    title: "Analytics",
    description: "\"Detecta oportunidades y frena pérdidas\"",
    color: "bg-purple-50 border-purple-100"
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-pink-600" />,
    title: "WhatsApp",
    description: "\"Administrá tu negocio por audio\"",
    color: "bg-pink-50 border-pink-100"
  }
];

export function Solution() {
  return (
    <section id="solucion" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Stockly hace el trabajo pesado
          </h2>
          <p className="text-lg text-slate-600">
            Una suite completa diseñada específicamente para las reglas, comisiones y dinámicas de Mercado Libre.
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
              className={`p-8 rounded-3xl border ${item.color} transition-shadow hover:shadow-md`}
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-700 italic">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
