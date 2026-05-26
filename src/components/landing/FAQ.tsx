"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "¿Necesito tarjeta de crédito para empezar?",
    a: "No, puedes crear tu cuenta y usar los 7 días de prueba gratuitos sin ingresar ninguna tarjeta de crédito."
  },
  {
    q: "¿Conecta directamente con Mercado Libre?",
    a: "Sí, nos integramos de forma oficial a través de la API de Mercado Libre. Toda la información se sincroniza en tiempo real de forma segura."
  },
  {
    q: "¿Puedo cancelar mi suscripción en cualquier momento?",
    a: "Absolutamente. No hay contratos de permanencia. Puedes cancelar tu plan cuando quieras desde el panel de configuración."
  },
  {
    q: "¿Cómo funciona el asistente por WhatsApp?",
    a: "Vinculamos un número de WhatsApp a tu cuenta de Stockly. Le escribes o envías audios como si fuera un empleado más, y la IA interpreta tus instrucciones y ejecuta cambios en tu cuenta (ej. 'Pausar producto X')."
  },
  {
    q: "¿La IA cambia cosas en mi cuenta por sí sola?",
    a: "Nunca. La IA detecta problemas u oportunidades y te envía notificaciones con sugerencias. Solo ejecutamos cambios si tú respondes 'Confirmo'."
  },
  {
    q: "¿Mis datos financieros son privados?",
    a: "Tu privacidad y seguridad son nuestra máxima prioridad. Usamos encriptación de nivel bancario y nunca compartimos tus datos de ventas o proveedores con terceros."
  },
  {
    q: "¿Cómo ayuda la IA con los títulos y la sincronización de mis publicaciones?",
    a: "Nuestra IA analiza tu producto (categoría, marca, atributos) para sugerir títulos optimizados para SEO que incrementan la exposición y las ventas. Además, con la sincronización inteligente de publicaciones hermanas, podés replicar y cambiar títulos o stock de publicaciones Clásica y Premium con el mismo SKU en un solo clic, sin hacerlo de a una."
  }
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Preguntas Frecuentes
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 transition-colors hover:bg-slate-100/50"
            >
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="font-semibold text-slate-900">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openIdx === idx ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 ml-4 text-slate-400"
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
                    <div className="px-6 pb-6 pt-0 text-slate-600">
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
