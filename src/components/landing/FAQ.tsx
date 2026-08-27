"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "¿Necesito ingresar tarjeta de crédito para la prueba gratis?",
    a: "No. Podés registrarte y probar Klyvo durante 15 días gratis sin ingresar datos de pago ni tarjeta. Solo pagás si decidís continuar."
  },
  {
    q: "¿Cómo se conecta Klyvo con mi cuenta de Mercado Libre?",
    a: "Nos conectamos de forma 100% oficial mediante el protocolo OAuth 2.0 de la API de Mercado Libre. No almacenamos tus contraseñas ni datos sensibles."
  },
  {
    q: "¿Klyvo ejecuta cambios de precios o stock por su cuenta sin mi permiso?",
    a: "Nunca. Podés configurar Klyvo en modo 'Auditor' (notificaciones y sugerencias de aprobación previa) o en modo 'Piloto Automático' con límites estrictos de margen mínimo que vos mismo definís."
  },
  {
    q: "¿Cómo se calcula el dinero o margen que me está haciendo perder Mercado Libre?",
    a: "Klyvo audita la comisión exacta cobrada por categoría, retenciones impositivas activas (IIBB, Percepciones), envíos Flex y costo de reposición del insumo. Si una publicación está vendiendo por debajo del costo o con una comisión excedente, te alerta de inmediato."
  },
  {
    q: "¿Puedo vincular múltiples cuentas de Mercado Libre en una sola suscripción?",
    a: "Sí, el plan Ultra y Enterprise permiten conectar múltiples cuentas de Mercado Libre para consolidar depósitos físicos y catálogo en un único panel unificado."
  },
  {
    q: "¿Cómo funciona la asistencia por WhatsApp?",
    a: "Podés enviar mensajes de voz o texto a nuestro número de WhatsApp vinculado para consultar facturación en vivo, pedir que pausemos productos en quiebre o ajustar un lote de precios sin abrir la computadora."
  }
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-slate-950 text-white border-b border-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300 mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            DESPEJÁ TUS DUDAS OPERATIVAS
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-slate-400 text-sm md:text-base">
            Todo lo que necesitás saber sobre la seguridad, integración y funcionamiento de Klyvo.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 transition-colors hover:border-slate-700"
            >
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="font-semibold text-white text-sm md:text-base">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openIdx === idx ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 ml-4 text-amber-400"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pt-0 text-slate-300 text-xs md:text-sm leading-relaxed border-t border-slate-800/60 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
