"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Premium Header */}
      <div className="relative bg-gradient-to-b from-slate-900 to-indigo-950 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link href="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white mb-6 p-0 hover:bg-transparent flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver a la Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
            <span className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">Aspectos Legales</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Términos de Servicio
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            Última actualización: 26 de Mayo, 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/80 space-y-8 prose prose-slate max-w-none">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. Aceptación de los Términos</h2>
            <p className="text-slate-600 leading-relaxed">
              Al registrarse, acceder o utilizar la plataforma de software Klyvo (en adelante, "el Servicio"), usted (en adelante, "el Usuario" o "el Cliente") acepta de forma incondicional y expresa estar sujeto a los presentes Términos de Servicio. Si no está de acuerdo con alguna sección, deberá abstenerse de utilizar el Servicio.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. Descripción del Servicio</h2>
            <p className="text-slate-600 leading-relaxed">
              Klyvo es una plataforma SaaS de optimización de operaciones comerciales para Mercado Libre. Proveemos herramientas basadas en inteligencia artificial, incluyendo la sugerencia de títulos optimizados para SEO, sincronización y replicación automática de stock y títulos entre publicaciones asociadas al mismo SKU ("publicaciones hermanas"), y un asistente de gestión operable vía WhatsApp.
            </p>
            <p className="text-slate-600 leading-relaxed">
              El Servicio se comercializa bajo un modelo de suscripción con diferentes límites mensuales de publicaciones, créditos de IA, procesos automáticos y soporte dedicados según el plan contratado (Starter, Pro, Ultra, Enterprise).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. Cuentas e Integración con Mercado Libre</h2>
            <p className="text-slate-600 leading-relaxed">
              Para utilizar Klyvo, el Usuario debe vincular su cuenta de Mercado Libre de forma oficial a través del protocolo OAuth. El Usuario garantiza que tiene el derecho y las facultades legales para autorizar dicha vinculación. El Usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso a Klyvo.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. Tarifas, Conversión y Medios de Pago</h2>
            <p className="text-slate-600 leading-relaxed">
              El Servicio se comercializa con tarifas referenciadas en dólares estadounidenses (USD) para posicionamiento global, pero se procesan localmente en Pesos Argentinos (ARS) a través de la pasarela segura de **Mercado Pago**.
            </p>
            <p className="text-slate-600 leading-relaxed">
              El tipo de cambio utilizado para la conversión a pesos se especifica de forma transparente en la sección de precios de la plataforma (multiplicador fijo de 1490 ARS por cada USD). Las suscripciones se debitan de forma auto-recurrente de manera mensual y pueden ser canceladas por el Usuario en cualquier momento desde el panel de facturación del dashboard, surtiendo efecto al finalizar el periodo facturado en curso.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">5. Uso Responsable y Limitación de Responsabilidad</h2>
            <p className="text-slate-600 leading-relaxed">
              Klyvo provee recomendaciones estratégicas mediante inteligencia artificial. Sin embargo, **ninguna acción de modificación crítica (cambios de precios, stock, títulos o estado de publicaciones) se realiza de forma automática sin la aprobación o confirmación explícita del Usuario** (ya sea confirmando mediante el botón correspondiente en el panel web o respondiendo "Confirmo" por WhatsApp).
            </p>
            <p className="text-slate-600 leading-relaxed">
              Por consiguiente, Klyvo no se responsabiliza por pérdidas económicas, penalizaciones del buscador de Mercado Libre, suspensiones de cuentas o pérdida de reputación que resulten de decisiones u operaciones confirmadas y validadas por el Usuario dentro de la plataforma.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">6. Terminación del Servicio</h2>
            <p className="text-slate-600 leading-relaxed">
              Nos reservamos el derecho de suspender o rescindir el acceso al Servicio a cualquier Usuario que viole las políticas de uso, realice prácticas abusivas con el bot de IA, o incurra en impagos de su suscripción.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">7. Contacto</h2>
            <p className="text-slate-600 leading-relaxed">
              Para cualquier consulta sobre estos Términos de Servicio, puede comunicarse con nuestro equipo de soporte a través de la sección de Ayuda en el panel de control o por correo electrónico a <span className="font-semibold text-indigo-600">soporte@klyvo.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
