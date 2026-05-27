"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const screenshots = [
  {
    name: "Intelligence Center",
    url: "/dashboard-intelligence-v2.png"
  },
  {
    name: "Gestión de Productos",
    url: "/dashboard-product-management-v2.png"
  },
  {
    name: "Stock Interno",
    url: "/dashboard-internal-stock-v2.png"
  },
  {
    name: "Asistente Operativo IA",
    url: "/dashboard-ai-assistant-v2.png"
  },
  {
    name: "Analíticas y Finanzas",
    url: "/dashboard-analytics-v2.png"
  }
];

export function Screenshots() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-24 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Todo lo que necesitas, en un solo lugar
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {screenshots.map((screen, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeTab === idx 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-white text-slate-600 hover:bg-slate-150 border border-slate-200"
              }`}
            >
              {screen.name}
            </button>
          ))}
        </div>

        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center">
               <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
            </div>
            <img 
              src={screenshots[activeTab].url} 
              alt={screenshots[activeTab].name} 
              className="w-full h-auto object-contain"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
