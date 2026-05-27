"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    limit: "Hasta 100 publicaciones",
    price: "$44 USD",
    priceArs: "equiv. $65.560 ARS",
    features: [
      "Tarifa de Lanzamiento (2 meses)",
      "7 días de prueba gratis",
      "Dashboard completo",
      "500 mensajes de IA",
      "250 procesos automáticos",
      "1 número de WhatsApp",
      "Gestión de Títulos con IA",
      "Stock en Mercado Libre y Depósito"
    ],
    buttonText: "Empezar gratis",
    popular: false
  },
  {
    name: "Pro",
    limit: "Hasta 500 publicaciones",
    price: "$79 USD",
    priceArs: "equiv. $117.710 ARS",
    features: [
      "Todo lo de Starter",
      "Tarifa de Lanzamiento (2 meses)",
      "1.500 mensajes de IA",
      "800 procesos automáticos",
      "Hasta 2 números de WhatsApp",
      "Soporte prioritario",
      "Optimización y Cambio Masivo de Títulos"
    ],
    buttonText: "Empezar",
    popular: true
  },
  {
    name: "Ultra",
    limit: "Hasta 2.500 publicaciones",
    price: "$129 USD",
    priceArs: "equiv. $192.210 ARS",
    features: [
      "Todo lo de Pro",
      "Tarifa de Lanzamiento (2 meses)",
      "5.000 mensajes de IA",
      "1.500 procesos automáticos",
      "Hasta 3 números de WhatsApp",
      "Soporte 24/7 por WhatsApp",
      "Optimización y Cambio Masivo de Títulos"
    ],
    buttonText: "Empezar",
    popular: false
  }
];

export function Pricing() {
  return (
    <section id="precios" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-100 text-indigo-700 mb-4 animate-pulse">
            🔥 Oferta de Lanzamiento: Cupos limitados a 15 clientes
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Planes simples y transparentes
          </h2>
          <p className="text-lg text-slate-600">
            Aprovechá la tarifa promocional por tus primeros 2 meses. ¡Asegurá tu lugar antes de que se agoten!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`relative bg-white rounded-3xl p-8 border ${plan.popular ? "border-indigo-500 shadow-xl shadow-indigo-100 scale-105 z-10" : "border-slate-200 shadow-sm"
                }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Más popular
                </div>
              )}

              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="text-sm text-slate-500 mt-2 h-5">{plan.limit}</p>

              <div className="my-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                  {plan.price !== "Consultar" && <span className="text-slate-500 ml-1">/mes</span>}
                </div>
                {plan.priceArs && (
                  <div className="text-xs text-slate-500 font-medium mt-1">
                    {plan.priceArs} / mes (Mercado Pago)
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start">
                    <Check className="w-5 h-5 text-emerald-500 mr-3 shrink-0" />
                    <span className="text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register" className="block w-full">
                <Button className={`w-full h-12 rounded-xl text-base font-bold transition-all ${plan.popular
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  }`}>
                  {plan.buttonText}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Enterprise Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 max-w-6xl mx-auto bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 rounded-3xl p-8 md:p-10 shadow-xl border border-indigo-900/40 relative overflow-hidden text-white flex flex-col md:flex-row items-center justify-between gap-8"
        >
          {/* Background decoration elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
              💎 EXCLUSIVO CORPORATIVO
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              ¿Operás a gran escala? Plan Enterprise
            </h3>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed">
              Diseñado para cuentas con más de 2.500 publicaciones, múltiples cuentas de Mercado Libre y altos volúmenes de facturación que necesitan infraestructura dedicada.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-sm text-slate-200">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Todo 100% Ilimitado</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Seguimiento y Auditoría de cuenta</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Soporte 24/7 y SLA Dedicado</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="https://calendly.com/klyvo-demo" target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button className="w-full md:w-auto bg-white hover:bg-slate-100 text-slate-950 h-14 rounded-2xl text-base font-bold px-8 shadow-lg transition-all border border-slate-200 flex items-center justify-center gap-2">
                Agendá una reunión
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
