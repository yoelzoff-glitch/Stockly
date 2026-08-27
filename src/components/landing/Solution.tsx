"use client";

import { motion } from "framer-motion";
import { 
  Calculator, 
  RefreshCw, 
  Sparkles, 
  MessageSquare, 
  Megaphone,
  PackageCheck,
  TrendingUp,
  ShieldCheck,
  Zap
} from "lucide-react";

export function Solution() {
  return (
    <section id="capacidades" className="py-24 bg-slate-950 text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-2">
            [ ARQUITECTURA DE CONTROL KLYVO ]
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Módulos especializados para dominar Mercado Libre
          </h2>
          <p className="text-slate-400 text-lg">
            Seis motores conectados directamente a la API oficial de Mercado Libre para automatizar finanzas, campañas de Product ADS, depósitos y bodega FULL.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Card 1: Large Hero Bento Card (Col span 7) - Margins & Financials */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-7 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-xs font-bold uppercase">
                  #01 / FINANCIAL ENGINE
                </span>
                <Calculator className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-3">
                Auditoría Financiera y Margen Limpio Real
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Klyvo consolida en tiempo real tus ventas de Mercado Libre descontando costo de reposición, comisiones variables, envíos Flex y percepciones impositivas (IIBB / Ganancias) para darte tu margen de ganancia real.
              </p>
            </div>

            {/* Micro Widget inside Card 1 */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800/90 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                <span>CONCILIACIÓN FINANCIERA</span>
                <span className="text-emerald-400 font-bold">100% OK</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-slate-900">
                  <p className="text-[10px] text-slate-500">COMISIONES MELI</p>
                  <p className="text-white font-bold text-sm mt-0.5">$ 840.200</p>
                </div>
                <div className="p-2 rounded bg-slate-900">
                  <p className="text-[10px] text-slate-500">IIBB / IMPUESTOS</p>
                  <p className="text-amber-400 font-bold text-sm mt-0.5">$ 194.500</p>
                </div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30">
                  <p className="text-[10px] text-emerald-400">MARGEN LIMPIO</p>
                  <p className="text-emerald-300 font-bold text-sm mt-0.5">28.4%</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Medium Bento Card (Col span 5) - Mercado Libre ADS Engine */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="md:col-span-5 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-xs font-bold uppercase">
                  #02 / MERCADO LIBRE ADS
                </span>
                <Megaphone className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Monitoreo de Mercado Libre Product ADS
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Medí tu ACOS y ROAS en tiempo real. Descubrí si tus campañas de publicidad de Mercado Libre están generando ventas rentables o comiéndose la ganancia del producto.
              </p>
            </div>

            {/* Micro Widget inside Card 2 */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800/90 text-xs">
              <div className="flex items-center justify-between font-mono mb-2">
                <span className="text-slate-400">PRODUCT ADS ACOS AUDIT</span>
                <span className="text-emerald-400 font-bold font-mono">ACOS: 7.2%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 font-mono text-[11px]">
                <span className="text-slate-300">ROAS Publicidad:</span>
                <span className="text-amber-400 font-bold">13.8x Retorno Limpio</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Medium Bento Card (Col span 6) - Stock FULL (Fulfillment) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="md:col-span-6 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 font-mono text-xs font-bold uppercase">
                  #03 / MERCADO LIBRE FULL
                </span>
                <PackageCheck className="w-6 h-6 text-emerald-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Gestión de Bodegas MeLi FULL & Depósito Propio
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Controlá el stock almacenado en los centros de distribución de Mercado Libre FULL. Recibí alertas automáticas antes de que un SKU en FULL se quede sin unidades para enviar reposición a tiempo.
              </p>
            </div>

            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800/90 font-mono text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Stock en Bodega FULL:</span>
                <span className="text-white font-bold">4.820 Unidades en 42 SKUs</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded text-[10px]">
                0 Stockouts en FULL
              </span>
            </div>
          </motion.div>

          {/* Card 4: Medium Bento Card (Col span 6) - Dynamic Repricer */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="md:col-span-6 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-indigo-400/10 border border-indigo-400/30 text-indigo-400 font-mono text-xs font-bold uppercase">
                  #04 / DYNAMIC REPRICER
                </span>
                <RefreshCw className="w-6 h-6 text-indigo-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Repricing Inteligente & Reglas de Margen
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Definí reglas automáticas para actualizar precios según la variación del dólar o costo de proveedor. Garantizá que ningún producto se venda por debajo del margen mínimo configurado.
              </p>
            </div>

            <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/90 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-300">Protección de Margen Mínimo:</span>
              <span className="text-indigo-300 font-bold">20.0% Garantizado</span>
            </div>
          </motion.div>

          {/* Card 5: Medium Bento Card (Col span 6) - SEO Title Optimizer */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="md:col-span-6 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-mono text-xs font-bold uppercase">
                  #05 / SEO TITLE GENERATOR
                </span>
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Optimización SEO Masiva de Títulos
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Inyectá las palabras clave con mayor volumen de búsqueda actual en Mercado Libre en tus títulos para incrementar la exposición de tus publicaciones sin pagar publicidad extra.
              </p>
            </div>

            <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/90 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-300">Aumento Promedio de Exposición:</span>
              <span className="text-cyan-400 font-bold">+40% Tráfico Orgánico</span>
            </div>
          </motion.div>

          {/* Card 6: Medium Bento Card (Col span 6) - WhatsApp AI Copilot */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="md:col-span-6 bg-slate-900 rounded-3xl p-8 border border-slate-800 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-purple-400/10 border border-purple-400/30 text-purple-400 font-mono text-xs font-bold uppercase">
                  #06 / WHATSAPP COPILOT
                </span>
                <MessageSquare className="w-6 h-6 text-purple-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Asistente por WhatsApp 24/7
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Consultá tu rendimiento en ADS, unidades restantes en FULL o autorizá cambios de precio con mensajes de voz o texto por WhatsApp.
              </p>
            </div>

            <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800/90 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-300">"Klyvo, ¿cuánto stock tengo en MeLi Full?"</span>
              <span className="text-purple-300 font-bold">4.820 Unidades</span>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
