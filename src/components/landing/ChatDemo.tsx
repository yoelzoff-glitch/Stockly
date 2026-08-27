"use client";

import { motion } from "framer-motion";
import { Bot, CheckCircle2, MessageSquare, Sparkles, Send } from "lucide-react";

export function ChatDemo() {
  return (
    <section id="demo" className="py-24 bg-slate-950 border-b border-slate-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-6 mb-12 lg:mb-0">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-2">
              [ COMANDOS VÍA WHATSAPP & WEB ]
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
              Tu copiloto de operaciones en el bolsillo
            </h2>
            <p className="text-base md:text-lg text-slate-300 mb-8 leading-relaxed">
              No necesitás estar sentado frente a una computadora todo el día. Administrá aumentos masivos de precios, pausá publicaciones en quiebre o consultá tu ganancia neta en segundos con un simple mensaje.
            </p>

            <div className="space-y-4 text-sm text-slate-300 font-mono">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>"Aumentá 4.5% toda la línea de accesorios de herramientas"</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>"Pausá los SKUs que tengan menos de 3 unidades en depósito"</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>"Reescribí los títulos de mis 10 productos menos vendidos"</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            {/* Phone Chat Container */}
            <div className="bg-slate-900 rounded-3xl p-4 shadow-2xl max-w-md mx-auto border border-slate-800 relative">
              <div className="bg-slate-950 rounded-2xl h-[460px] overflow-hidden flex flex-col border border-slate-800">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white font-mono">Klyvo WhatsApp AI</h3>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Conectado MeLi API
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 bg-slate-800 rounded text-slate-400">
                    24/7 ONLINE
                  </span>
                </div>

                {/* Chat Body */}
                <div className="flex-1 p-4 space-y-4 font-sans text-xs overflow-y-auto">
                  
                  {/* User message */}
                  <motion.div 
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="flex justify-end"
                  >
                    <div className="bg-slate-800 text-slate-100 p-3 rounded-2xl rounded-tr-none max-w-[85%] border border-slate-700 shadow-sm">
                      Subime 3.5% todos los productos de categoría Herramientas
                      <span className="text-[9px] font-mono text-slate-400 block text-right mt-1">10:42 AM</span>
                    </div>
                  </motion.div>

                  {/* Bot response */}
                  <motion.div 
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-start"
                  >
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-2xl rounded-tl-none max-w-[88%] border border-slate-800 shadow-sm space-y-2">
                      <p className="font-semibold text-emerald-400 font-mono text-[11px]">
                        ⚡ Simulación de Impacto Pre-Ajuste:
                      </p>
                      <p className="text-slate-300">
                        • 18 Publicaciones afectadas<br/>
                        • Impacto de Ganancia: +$ 54.200 ARS/mes<br/>
                        • Margen promedio resultante: 29.1%
                      </p>
                      <p className="text-amber-400 font-mono text-[10px]">
                        Respondé "CONFIRMAR" para sincronizar MeLi.
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 block text-right">10:42 AM</span>
                    </div>
                  </motion.div>

                  {/* User confirm */}
                  <motion.div 
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className="flex justify-end"
                  >
                    <div className="bg-amber-400 text-slate-950 font-bold p-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                      CONFIRMAR
                      <span className="text-[9px] font-mono text-slate-800 block text-right mt-1 font-normal">10:43 AM</span>
                    </div>
                  </motion.div>

                  {/* Bot final */}
                  <motion.div 
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.9 }}
                    className="flex justify-start"
                  >
                    <div className="bg-emerald-950/40 text-emerald-200 p-3 rounded-2xl rounded-tl-none max-w-[85%] border border-emerald-500/30">
                      <p className="font-bold flex items-center gap-1 font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Sincronización exitosa
                      </p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Las 18 publicaciones fueron actualizadas en Mercado Libre.
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 block text-right mt-1">10:43 AM</span>
                    </div>
                  </motion.div>

                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
