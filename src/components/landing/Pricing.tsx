"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    limit: "Hasta 100 SKUs activos",
    price: "$ 49,99 USD",
    priceArs: "equiv. $ 78.984 ARS",
    features: [
      "15 días de prueba 100% gratis",
      "Dashboard Financiero MeLi",
      "Auditoría de Comisiones y Margen",
      "500 consultas de IA / mes",
      "250 procesos de sync automático",
      "1 número de WhatsApp vinculado",
      "Optimización de Títulos SEO"
    ],
    buttonText: "Empezar prueba gratis",
    popular: false
  },
  {
    name: "Pro",
    limit: "Hasta 400 SKUs activos",
    price: "$ 79,99 USD",
    priceArs: "equiv. $ 126.384 ARS",
    features: [
      "Todo lo de Starter",
      "15 días de prueba gratis",
      "Repricing automático dinámico",
      "1.500 consultas de IA / mes",
      "800 procesos automáticos",
      "Hasta 2 números de WhatsApp",
      "Soporte prioritario por WhatsApp",
      "Optimización masiva de títulos"
    ],
    buttonText: "Asegurar Tarifa Pro",
    popular: true
  },
  {
    name: "Ultra",
    limit: "Hasta 1.000 SKUs activos",
    price: "$ 129,99 USD",
    priceArs: "equiv. $ 205.384 ARS",
    features: [
      "Todo lo de Pro",
      "Tarifa congelada por 6 meses",
      "5.000 consultas de IA / mes",
      "1.500 procesos automáticos",
      "Hasta 3 números de WhatsApp",
      "Guardián de stockouts en tiempo real",
      "Capacitación de equipo incluida"
    ],
    buttonText: "Obtener Plan Ultra",
    popular: false
  }
];

export function Pricing() {
  return (
    <section id="precios" className="py-24 bg-slate-950 text-white border-b border-slate-800 bg-grid-pattern-dark relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-amber-400/10 border border-amber-400/30 text-amber-400 mb-4 animate-pulse">
            🔥 CUPOS DE LANZAMIENTO: Solo 15 plazas promocionales disponibles
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Planes transparentes adaptados a tu catálogo
          </h2>
          <p className="text-slate-400 text-lg">
            Proba 15 días gratis sin tarjeta obligatoria. Facturación mensual en ARS vía Mercado Pago o USD.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`relative rounded-3xl p-8 border flex flex-col justify-between transition-all ${
                plan.popular 
                  ? "bg-slate-900 border-amber-400/80 shadow-2xl shadow-amber-400/10 scale-105 z-10" 
                  : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[10px] font-mono font-extrabold uppercase tracking-widest py-1 px-4 rounded-full shadow-md">
                  MÁS RECOMENDADO POR VENDEDORES
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white font-mono">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">{plan.limit}</p>

                <div className="my-6 pt-4 border-t border-slate-800">
                  <div className="flex items-baseline">
                    <span className="text-3xl md:text-4xl font-extrabold text-white font-mono">{plan.price}</span>
                    <span className="text-slate-400 text-xs ml-1 font-mono">/mes</span>
                  </div>
                  {plan.priceArs && (
                    <p className="text-xs text-amber-400 font-mono mt-1">
                      {plan.priceArs} / mes (Mercado Pago)
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 text-xs text-slate-300">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/register" className="block w-full mt-auto">
                <Button className={`w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  plan.popular
                    ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
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
          className="mt-16 max-w-6xl mx-auto bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-8 md:p-10 border border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex-1 space-y-3 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-indigo-400/10 border border-indigo-400/30 text-indigo-300 font-bold uppercase">
              💎 PLAN ENTERPRISE / MULTI-CUENTA
            </span>
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              ¿Manejás más de 1.000 SKUs o múltiples cuentas MeLi?
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-light">
              Desplegamos una instancia dedicada con soporte SLA 24/7, integración personalizada con tu ERP propio y auditor de impuestos corporativo a medida.
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="https://calendly.com/klyvo-demo" target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button className="w-full md:w-auto bg-white hover:bg-slate-100 text-slate-950 h-13 rounded-xl text-xs font-mono font-bold px-8 shadow-lg uppercase tracking-wider flex items-center justify-center gap-2">
                Agendar reunión con especialista
              </Button>
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
