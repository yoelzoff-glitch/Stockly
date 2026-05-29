"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const screenshots = [
  {
    name: "Intelligence Center",
    url: "/dashboard-intelligence-v2.png",
    tagline: "El cerebro predictivo de tu negocio",
    description: "Klyvo analiza tu historial de ventas y te avisa exactamente cuándo vas a quebrar stock antes de que suceda. Detecta el capital inmovilizado y te sugiere acciones inmediatas (como pausar publicaciones o subir precios) para que nunca pierdas posicionamiento en Mercado Libre."
  },
  {
    name: "Gestión de Productos",
    url: "/dashboard-product-management-v2.png",
    tagline: "Rentabilidad real garantizada",
    description: "Olvidate del Excel. Cruzamos tus costos de insumos, impuestos, comisiones y los gastos exactos de cada zona Flex. Sabrás el margen neto exacto de cada venta en tiempo real, permitiéndote apagar al instante las publicaciones que te hacen perder plata."
  },
  {
    name: "Stock Interno",
    url: "/dashboard-internal-stock-v2.png",
    tagline: "Combos e inventario sincronizados al 100%",
    description: "Carga tus insumos una sola vez. Cada vez que vendes un combo en ML, Klyvo descuenta automáticamente las partes individuales de tu depósito real. Se acabó el caos de no saber cuántos materiales te quedan para ensamblar."
  },
  {
    name: "Asistente Operativo IA",
    url: "/dashboard-ai-assistant-v2.png",
    tagline: "Tu gerente de operaciones 24/7",
    description: "¿Querés saber qué producto te dejó más ganancia hoy? ¿O qué proveedor tenés que llamar para reponer mercadería? Preguntale a Klyvo. Nuestra Inteligencia Artificial procesa tus finanzas en segundos y te da las respuestas clave para dominar el mercado."
  },
  {
    name: "Analíticas y Finanzas",
    url: "/dashboard-analytics-v2.png",
    tagline: "Radiografía financiera en tiempo real",
    description: "Visualizá tus ingresos brutos, ticket promedio y la ganancia neta estimada en un tablero dinámico. Descubrí de un vistazo qué publicaciones lideran tus ventas para enfocar tu inversión donde realmente importa."
  }
];

export function Screenshots() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="relative py-32 overflow-hidden bg-slate-950 pt-40">
      {/* Shape Divider matching ChatDemo bg-slate-900 */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0]">
        <svg className="relative block w-full h-[50px] md:h-[80px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" className="fill-slate-900 opacity-100"></path>
        </svg>
      </div>

      {/* Top subtle glowing border for extra separation */}
      <div className="absolute top-[50px] md:top-[80px] inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>

      {/* Background glowing effects for volume */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Todo lo que necesitás para escalar, <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">en un solo lugar</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Descubrí por qué los vendedores líderes están abandonando los sistemas tradicionales para pasarse a la gestión impulsada por Inteligencia Artificial de Klyvo.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {screenshots.map((screen, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm ${
                activeTab === idx 
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.4)]" 
                  : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50 backdrop-blur-sm"
              }`}
            >
              {screen.name}
            </button>
          ))}
        </div>

        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Card with Glassmorphism and Depth */}
          <div className="rounded-3xl border border-white/10 bg-slate-800/40 backdrop-blur-xl p-10 md:p-20 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* Inner subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
            
            <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">
              {screenshots[activeTab].tagline}
            </h3>
            <p className="text-lg md:text-2xl text-slate-300 leading-relaxed max-w-4xl mx-auto font-light">
              {screenshots[activeTab].description}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
