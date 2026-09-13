"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FadeUp } from "./motion";

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
    q: "¿LibretaX necesita mi contraseña?",
    a: "No. LibretaX nunca solicita, recibe ni almacena tu contraseña personal de Mercado Libre ni tus credenciales de inicio de sesión.",
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
    a: "Sí. Podés revocar el acceso en cualquier momento desde el panel de integraciones de LibretaX o directamente desde la administración de aplicaciones conectadas en tu perfil de Mercado Libre.",
  },
  {
    q: "¿LibretaX modifica precios o stock automáticamente?",
    a: "Solo cuando configurás reglas operativas de sincronización que vos mismo habilitás voluntariamente. LibretaX no realiza modificaciones sobre tu catálogo sin tu previa autorización.",
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
    <section id="faq" className="py-20 md:py-28 border-b border-[rgba(0,57,104,0.10)] bg-white">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="mb-14 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#00DFDB]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#003968]">
                Preguntas frecuentes
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#002B4D] tracking-tight">
              Respuestas claras sobre el funcionamiento de LibretaX.
            </h2>
            <p className="text-base sm:text-lg text-[rgba(0,43,77,0.70)]">
              Información operativa y técnica sobre integración, cálculo de márgenes y seguridad.
            </p>
          </div>
        </FadeUp>

        {/* Accordion List */}
        <FadeUp delay={0.1}>
          <div className="border-t border-[rgba(0,57,104,0.10)] divide-y divide-[rgba(0,57,104,0.10)]">
            {faqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={idx} className="py-5">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="w-full flex items-center justify-between text-left gap-4 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB] rounded-lg p-1 -m-1"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base sm:text-lg font-bold text-[#002B4D] group-hover:text-[#003968] transition-colors">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-[rgba(0,43,77,0.60)] shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[#00DFDB]" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="mt-3 pr-4 text-sm sm:text-base text-[rgba(0,43,77,0.70)] leading-relaxed animate-in fade-in-50 duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FadeUp>

        {/* Contact Help Card */}
        <FadeUp delay={0.2}>
          <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-[rgba(0,57,104,0.025)] border border-[rgba(0,57,104,0.12)] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h3 className="text-base font-bold text-[#002B4D]">
                ¿Tenés alguna otra consulta o duda técnica?
              </h3>
              <p className="text-sm text-[rgba(0,43,77,0.70)] max-w-md">
                Escribinos directamente por WhatsApp o a nuestra casilla de soporte. Estamos para ayudarte.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <a
                href="https://wa.me/5491166085798?text=Hola%20LibretaX%2C%20tengo%20una%20consulta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#003968] hover:bg-[#002B4D] transition-colors shadow-xs"
              >
                <span>WhatsApp: 11 6608-5798</span>
              </a>
              <a
                href="mailto:soporte@libretax.com.ar"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#003968] bg-white border border-[rgba(0,57,104,0.20)] hover:bg-[rgba(0,223,219,0.08)] transition-colors shadow-xs"
              >
                <span>soporte@libretax.com.ar</span>
              </a>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
