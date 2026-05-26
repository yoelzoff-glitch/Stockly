"use client";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

export function ChatDemo() {
  return (
    <section id="demo" className="py-24 bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent opacity-50"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="mb-16 lg:mb-0">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Tu asistente de operaciones, siempre disponible
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              Administrá miles de publicaciones con un simple mensaje de WhatsApp. Stockly entiende tus intenciones, calcula el impacto financiero y ejecuta las acciones instantáneamente.
            </p>
            <ul className="space-y-4 text-slate-300">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                Pausar publicaciones sin stock
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                Ajustar precios por lote
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                Consultar rentabilidad de un producto
              </li>
            </ul>
          </div>

          <div className="relative">
            {/* Phone Mockup */}
            <div className="bg-[#E5DDD5] rounded-3xl p-4 shadow-2xl max-w-md mx-auto border-[8px] border-slate-800 relative">
              <div className="bg-slate-100/80 rounded-2xl h-[500px] overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <div className="bg-[#075E54] text-white p-4 flex items-center shadow-md z-10">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#075E54] mr-3">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Stockly AI</h3>
                    <p className="text-xs text-white/80">en línea</p>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center">
                  
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="flex justify-end"
                  >
                    <div className="bg-[#DCF8C6] text-slate-800 p-3 rounded-xl rounded-tr-none max-w-[85%] shadow-sm text-sm relative">
                      Subime 3% todos los productos con C144
                      <span className="text-[10px] text-slate-500 absolute bottom-1 right-2">10:42</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.8 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white text-slate-800 p-3 rounded-xl rounded-tl-none max-w-[85%] shadow-sm text-sm relative">
                      Encontré 12 publicaciones que contienen C144.<br/><br/>
                      Aumento promedio: 3%<br/>
                      Impacto estimado: +$42.500/mes.<br/><br/>
                      ¿Confirmás la actualización en Mercado Libre?
                      <span className="text-[10px] text-slate-500 absolute bottom-1 right-2">10:42</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 1.6 }}
                    className="flex justify-end"
                  >
                    <div className="bg-[#DCF8C6] text-slate-800 p-3 rounded-xl rounded-tr-none max-w-[85%] shadow-sm text-sm relative">
                      Confirmo
                      <span className="text-[10px] text-slate-500 absolute bottom-1 right-2">10:43</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 2.4 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white text-slate-800 p-3 rounded-xl rounded-tl-none max-w-[85%] shadow-sm text-sm relative">
                      ✅ Listo. Precios actualizados en Mercado Libre.
                      <span className="text-[10px] text-slate-500 absolute bottom-1 right-2">10:43</span>
                    </div>
                  </motion.div>

                </div>
              </div>
            </div>
            
            <div className="absolute -inset-4 bg-indigo-500/20 blur-3xl -z-10 rounded-full"></div>
          </div>

        </div>
      </div>
    </section>
  );
}
