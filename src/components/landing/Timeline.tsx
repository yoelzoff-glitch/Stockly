"use client";

import { motion } from "framer-motion";

const steps = [
  { num: "1", title: "Vinculación Instantánea", desc: "Vinculá tu cuenta de Mercado Libre en 2 clics de forma 100% segura mediante la API oficial." },
  { num: "2", title: "Auditoría en Minutos", desc: "Stockly analiza automáticamente todo tu historial de ventas, comisiones, costos impositivos y reputación." },
  { num: "3", title: "Detección de Fugas", desc: "La IA escanea tu catálogo y te revela al centavo dónde estás perdiendo margen y qué publicaciones tienen stock en riesgo." },
  { num: "4", title: "Copiloto Operativo", desc: "Recibís alertas directas por WhatsApp o en tu Dashboard con sugerencias de títulos SEO, precios y stock." },
  { num: "5", title: "Automatización Masiva", desc: "Confirmás con un simple comando y la IA ejecuta los cambios en lote al instante en Mercado Libre. Así de simple." }
];

export function Timeline() {
  return (
    <section id="como-funciona" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Cómo funciona
          </h2>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-100 -translate-x-1/2"></div>
          
          <div className="space-y-12">
            {steps.map((step, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`flex flex-col md:flex-row items-center justify-between ${isEven ? 'md:flex-row-reverse' : ''}`}
                >
                  <div className="w-full md:w-5/12"></div>
                  
                  {/* Number Circle */}
                  <div className="z-10 flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg shadow-md mb-4 md:mb-0 border-4 border-white shrink-0">
                    {step.num}
                  </div>
                  
                  <div className={`w-full md:w-5/12 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm text-center ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-600">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
