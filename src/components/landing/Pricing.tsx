"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    limit: "Hasta 500 publicaciones",
    price: "$25 USD",
    features: [
      "Dashboard completo",
      "IA Básica",
      "Cálculo de rentabilidad",
      "Gestión de productos",
      "7 días de prueba gratis"
    ],
    buttonText: "Empezar gratis",
    popular: false
  },
  {
    name: "Growth",
    limit: "Hasta 2000 publicaciones",
    price: "$49 USD",
    features: [
      "Todo lo de Starter",
      "Asistente por WhatsApp",
      "Control de Stock interno",
      "Promociones automáticas",
      "Analytics avanzados"
    ],
    buttonText: "Empezar",
    popular: true
  },
  {
    name: "Scale",
    limit: "5000+ publicaciones",
    price: "$89 USD",
    features: [
      "Todo lo de Growth",
      "IA avanzada sin límites",
      "Automatizaciones custom",
      "Acceso API",
      "Soporte prioritario 24/7"
    ],
    buttonText: "Contactar ventas",
    popular: false
  }
];

export function Pricing() {
  return (
    <section id="precios" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Planes simples y transparentes
          </h2>
          <p className="text-lg text-slate-600">
            Diseñados para escalar con tus ventas en Mercado Libre.
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
              className={`relative bg-white rounded-3xl p-8 border ${
                plan.popular ? "border-indigo-500 shadow-xl shadow-indigo-100 scale-105 z-10" : "border-slate-200 shadow-sm"
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
                <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                {plan.price !== "Consultar" && <span className="text-slate-500">/mes</span>}
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
                <Button className={`w-full h-12 rounded-xl text-base font-bold transition-all ${
                  plan.popular 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                }`}>
                  {plan.buttonText}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
