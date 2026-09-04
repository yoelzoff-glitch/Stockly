"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: "¿Cómo se conecta Mercado Libre?",
    a: "Mediante la autorización oficial OAuth 2.0 de Mercado Libre. Al hacer clic en vincular, el sistema te redirige a la pantalla segura de Mercado Libre donde autorizás los permisos necesarios de lectura y sincronización.",
  },
  {
    q: "¿Klyvo necesita mi contraseña?",
    a: "No. Klyvo nunca solicita, recibe ni almacena tu contraseña personal de Mercado Libre ni tus credenciales de inicio de sesión.",
  },
  {
    q: "¿Cómo calcula la rentabilidad?",
    a: "Descuenta del precio de cobro la comisión exacta de Mercado Libre por categoría, la tarifa neta de envío (Mercado Envíos o Flex), los descuentos promocionales, la publicidad atribuida y el costo de reposición que hayas asignado al producto.",
  },
  {
    q: "¿Qué información debo cargar?",
    a: "Únicamente el costo de compra o reposición de tus productos o insumos físicos. Las ventas, publicaciones, comisiones y cargos de envío se importan automáticamente a través de la integración oficial.",
  },
  {
    q: "¿Cada empresa puede ver solamente sus datos?",
    a: "Sí. Cada cuenta funciona con aislamiento estricto mediante Row Level Security (RLS) a nivel de base de datos. No existe posibilidad de filtración o cruce de información entre distintos vendedores.",
  },
  {
    q: "¿Puedo desconectar mi cuenta?",
    a: "Sí. Podés revocar el acceso en cualquier momento desde el panel de integraciones de Klyvo o directamente desde la administración de aplicaciones conectadas en tu perfil de Mercado Libre.",
  },
  {
    q: "¿Klyvo modifica precios o stock automáticamente?",
    a: "Solo cuando configurás reglas operativas de sincronización que vos mismo habilitás voluntariamente. Klyvo no realiza modificaciones sobre tu catálogo sin tu previa autorización.",
  },
  {
    q: "¿Qué sucede si una sincronización falla?",
    a: "La plataforma utiliza colas con reintentos controlados y lógica idempotente. Si la API externa tiene una demora temporal, el proceso se reintenta automáticamente sin generar duplicaciones de ventas ni desfasajes en el stock.",
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 border-b border-[#DCDAD4] bg-white">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-14 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Preguntas frecuentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Respuestas claras sobre el funcionamiento de Klyvo.
          </h2>
          <p className="text-base text-[#5F6875]">
            Información operativa y técnica sobre integración, cálculo de márgenes y seguridad.
          </p>
        </div>

        {/* Accordion List */}
        <div className="border-t border-[#DCDAD4] divide-y divide-[#DCDAD4]">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className="py-5">
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between text-left gap-4 group focus:outline-hidden"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-[#101828] group-hover:text-[#102A56] transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#5F6875] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#102A56]" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-3 pr-4 text-sm sm:text-base text-[#5F6875] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
