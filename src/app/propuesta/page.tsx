"use me";
"use client";

import React from "react";
import { 
  Bot, 
  ShieldCheck, 
  TrendingUp, 
  Boxes, 
  MessageSquareText, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Zap, 
  Lock, 
  Sparkles,
  Award,
  Calculator,
  PieChart as PieChartIcon,
  DollarSign,
  Truck,
  RotateCcw,
  BarChart3,
  Package,
  Layers,
  ArrowRight
} from "lucide-react";

export default function PropuestaComercialPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 print:p-0 print:bg-white print:text-slate-900">
      {/* Estilos de Impresión Especiales: Espaciado Compacto sin Hojas en Blanco */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            background-color: #f8fafc !important;
            color: #0f172a !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            margin-bottom: 0.75rem !important;
            padding: 0.75rem !important;
          }
          .print-header {
            background: linear-gradient(135deg, #0f172a, #1e293b) !important;
            color: #ffffff !important;
            border-radius: 8px !important;
            padding: 1rem !important;
            margin-bottom: 0.75rem !important;
          }
          .print-badge {
            border: 1px solid #94a3b8 !important;
            color: #ffffff !important;
            background-color: #334155 !important;
          }
          .print-section {
            break-inside: avoid !important;
            margin-bottom: 0.75rem !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.75rem !important;
          }
          h1, h2, h3, h4 {
            color: #0f172a !important;
          }
          .print-header h1, .print-header h2, .print-header p {
            color: #ffffff !important;
          }
        }
      `}</style>

      {/* Botón Flotante para Imprimir / PDF */}
      <div className="no-print fixed bottom-6 right-6 z-50 flex gap-3">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3.5 rounded-full shadow-xl shadow-indigo-600/40 transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
        >
          <Printer className="w-5 h-5" />
          Imprimir / Descargar PDF (Diseño Optimizado)
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-6 print:space-y-3">
        
        {/* SECCIÓN 1: CARÁTULA Y CABECERA COMPACTA */}
        <header className="print-header bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/50">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white">KLYVO</h1>
                  <p className="text-[10px] text-indigo-300 font-bold tracking-widest uppercase">Operador Inteligente e-Commerce para Mercado Libre</p>
                </div>
              </div>
              <span className="print-badge inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Propuesta Comercial & Dossier de Producto
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <h2 className="text-lg md:text-xl font-bold text-white leading-snug">
                Gestión Inteligente, Rentabilidad Unitaria Real y Automatización con IA
              </h2>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed print:text-slate-200">
                Plataforma SaaS empresarial que elimina la venta con margen negativo, clasifica tu catálogo mediante Pareto (80/20) y permite controlar tu operación por WhatsApp con texto y notas de voz.
              </p>
            </div>
          </div>
        </header>

        {/* SECCIÓN 2: PROBLEMA VS SOLUCIÓN (EN GRID COMPACTO) */}
        <section className="print-section space-y-3">
          <div className="border-b border-slate-800 print:border-slate-300 pb-1.5">
            <h3 className="text-base md:text-lg font-bold text-white print:text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400 print:text-indigo-600" />
              El Desafío del Vendedor vs. La Solución Klyvo
            </h3>
          </div>

          <div className="grid md:grid-cols-2 print-grid gap-3">
            <div className="print-card bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400 print:text-amber-700 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> Dolores Habituales del Vendedor
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 print:text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-extrabold">✕</span>
                  <span><strong>Margen Oculto:</strong> Ganancia ilusoria por ignorar comisiones variables, cuotas, envíos gratis e impuestos.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-extrabold">✕</span>
                  <span><strong>Catálogo a Ciegas:</strong> Sin saber cuáles productos generan el 80% del margen y cuáles absorben rentabilidad.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-extrabold">✕</span>
                  <span><strong>Errores Humanos:</strong> Equivocaciones en listas de precios o cambios masivos que causan pérdidas de dinero.</span>
                </li>
              </ul>
            </div>

            <div className="print-card bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-indigo-400 print:text-indigo-700 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" /> La Respuesta de Klyvo
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 print:text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-extrabold">✓</span>
                  <span><strong>Margen Neto Unitario:</strong> Deducción punto por punto de comisiones, envío, cuotas e impuestos por producto.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-extrabold">✓</span>
                  <span><strong>Pareto 80/20 & Curva ABC:</strong> Potenciar los productos "Estrella" (Clase A) y eliminar los "Tóxicos".</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-extrabold">✓</span>
                  <span><strong>Escudo Anti-Errores:</strong> Bloqueos automáticos &gt;30% y confirmación requerida con palabra clave "confirmo".</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: CONTABILIDAD Y MARGEN NETO + PARETO (SIDE BY SIDE EN GRID) */}
        <section className="print-section space-y-3">
          <div className="grid md:grid-cols-2 print-grid gap-3">
            
            {/* CONTABILIDAD */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800 print:border-slate-300 pb-2">
                <Calculator className="w-4 h-4 text-emerald-400 print:text-emerald-600" />
                <h4 className="text-sm font-bold text-white print:text-slate-900">Desglose Contable de Precisión</h4>
              </div>
              <div className="bg-slate-950 print:bg-slate-100 p-2 rounded-lg border border-slate-800 print:border-slate-300 text-center">
                <code className="text-[11px] font-mono text-emerald-400 print:text-emerald-800 font-bold">
                  Margen = Venta - (COGS + ML + Envíos + Cuotas + Packaging + IVA)
                </code>
              </div>
              <ul className="space-y-1 text-xs text-slate-300 print:text-slate-700">
                <li className="flex justify-between">
                  <span className="font-semibold text-indigo-300 print:text-indigo-800">• Comisiones Mercado Libre:</span>
                  <span>Deducción exacta por categoría</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-emerald-300 print:text-emerald-800">• Campañas de Cuotas:</span>
                  <span>Descuento por 3, 6 o 12 cuotas</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-cyan-300 print:text-cyan-800">• Logística & Packaging:</span>
                  <span>Absorción de envío gratis y cajas</span>
                </li>
              </ul>
            </div>

            {/* PARETO 80/20 */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800 print:border-slate-300 pb-2">
                <PieChartIcon className="w-4 h-4 text-indigo-400 print:text-indigo-600" />
                <h4 className="text-sm font-bold text-white print:text-slate-900">Análisis de Pareto (80/20) & Curva ABC</h4>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center bg-slate-950/60 print:bg-white p-1.5 rounded border border-slate-800 print:border-slate-300 text-xs">
                  <span className="font-bold text-emerald-400 print:text-emerald-700">Clase A (20% Catálogo)</span>
                  <span className="text-slate-300 print:text-slate-700 font-semibold">Generan el 80% del Margen Neto</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/60 print:bg-white p-1.5 rounded border border-slate-800 print:border-slate-300 text-xs">
                  <span className="font-bold text-indigo-400 print:text-indigo-700">Clase B (30% Catálogo)</span>
                  <span className="text-slate-300 print:text-slate-700">Aportan 15% del volumen comercial</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/60 print:bg-white p-1.5 rounded border border-slate-800 print:border-slate-300 text-xs">
                  <span className="font-bold text-red-400 print:text-red-700">Clase C (50% Catálogo)</span>
                  <span className="text-slate-300 print:text-slate-700">Productos residuales o de margen negativo</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECCIÓN 4: PRECIOS, LOGÍSTICA, IA Y SEGURIDAD (GRID DE 4 TARJETAS COMPACTAS) */}
        <section className="print-section space-y-3">
          <div className="border-b border-slate-800 print:border-slate-300 pb-1.5">
            <h3 className="text-base md:text-lg font-bold text-white print:text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400 print:text-amber-600" />
              Módulos Especializados y Funciones Avanzadas
            </h3>
          </div>

          <div className="grid md:grid-cols-2 print-grid gap-3">
            
            {/* TARJETA 1 */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 print:text-amber-700 font-bold text-xs">
                <DollarSign className="w-4 h-4" /> Precios Sugeridos & Competencia
              </div>
              <p className="text-xs text-slate-300 print:text-slate-700">
                Recomendación de precio objetivo según margen deseado. Simulador financiero de variaciones y rastreo de precios de competidores directos.
              </p>
            </div>

            {/* TARJETA 2 */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 print:text-cyan-700 font-bold text-xs">
                <Truck className="w-4 h-4" /> Envíos, Flex, Full & Cancelaciones
              </div>
              <p className="text-xs text-slate-300 print:text-slate-700">
                Desglose de margen por canal logístico (Flex/Full/Colecta). Auditoría de costo no recuperado por devoluciones y preservación de reputación.
              </p>
            </div>

            {/* TARJETA 3 */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-400 print:text-indigo-700 font-bold text-xs">
                <MessageSquareText className="w-4 h-4" /> WhatsApp con Audios (Whisper AI)
              </div>
              <p className="text-xs text-slate-300 print:text-slate-700">
                Operá enviando textos o notas de voz desde tu celular (*"¿Cuánto vendimos hoy y cuál fue el margen?"*). Transcripción e inferencia instantánea.
              </p>
            </div>

            {/* TARJETA 4 */}
            <div className="print-card bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 print:text-emerald-700 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" /> Escudo Anti-Errores & Depósito BOM
              </div>
              <p className="text-xs text-slate-300 print:text-slate-700">
                Bloqueo automático ante cambios de precio mayores al 30%, palabra clave "confirmo" obligatoria y reabastecimiento predictivo a 30 días (+20% seguridad).
              </p>
            </div>

          </div>
        </section>

        {/* SECCIÓN 5: TABLA DE PLANES COMERCIALES COMPACTA */}
        <section className="print-section space-y-2">
          <div className="border-b border-slate-800 print:border-slate-300 pb-1">
            <h3 className="text-base md:text-lg font-bold text-white print:text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400 print:text-indigo-600" />
              Planes Comerciales Disponibles
            </h3>
          </div>

          <div className="overflow-x-auto print-card p-0 bg-transparent border-0">
            <table className="w-full text-left text-xs print:text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600">
                  <th className="py-2 px-3 font-semibold">Funcionalidad</th>
                  <th className="py-2 px-3 font-semibold text-center">Starter 🚀</th>
                  <th className="py-2 px-3 font-semibold text-center bg-indigo-950/40 print:bg-slate-100 font-bold text-indigo-300 print:text-indigo-800">Pro 🏆</th>
                  <th className="py-2 px-3 font-semibold text-center">Ultra ⚡</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 text-[11px]">
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Catálogo / Límite de SKUs</td>
                  <td className="py-2 px-3 text-center">Hasta 100 SKUs</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-400 print:text-indigo-700 bg-indigo-950/20 print:bg-slate-50">Hasta 400 SKUs</td>
                  <td className="py-2 px-3 text-center">Hasta 1.000 SKUs</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Consultas de IA / Mensajes Mes</td>
                  <td className="py-2 px-3 text-center">500 consultas/mes</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-400 print:text-indigo-700 bg-indigo-950/20 print:bg-slate-50">1.500 consultas/mes</td>
                  <td className="py-2 px-3 text-center">5.000 consultas/mes</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Procesos Automáticos en Segundo Plano</td>
                  <td className="py-2 px-3 text-center">250 procesos/mes</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-400 print:text-indigo-700 bg-indigo-950/20 print:bg-slate-50">800 procesos/mes</td>
                  <td className="py-2 px-3 text-center">1.500 procesos/mes</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">WhatsApp IA (Texto + Notas de Voz)</td>
                  <td className="py-2 px-3 text-center">1 número WhatsApp</td>
                  <td className="py-2 px-3 text-center font-bold text-indigo-400 print:text-indigo-700 bg-indigo-950/20 print:bg-slate-50">Hasta 2 números</td>
                  <td className="py-2 px-3 text-center">Hasta 3 números</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Margen Neto & Análisis Pareto (80/20)</td>
                  <td className="py-2 px-3 text-center text-emerald-400">✓ Incluido</td>
                  <td className="py-2 px-3 text-center text-emerald-400 font-bold bg-indigo-950/20 print:bg-slate-50">✓ Incluido</td>
                  <td className="py-2 px-3 text-center text-emerald-400">✓ Incluido</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Depósito BOM & Predicción 30d</td>
                  <td className="py-2 px-3 text-center text-emerald-400">✓ Incluido</td>
                  <td className="py-2 px-3 text-center text-emerald-400 font-bold bg-indigo-950/20 print:bg-slate-50">✓ Incluido</td>
                  <td className="py-2 px-3 text-center text-emerald-400">✓ Incluido</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-200 print:text-slate-900">Precios Sugeridos & Competidores</td>
                  <td className="py-2 px-3 text-center text-slate-500">✕</td>
                  <td className="py-2 px-3 text-center text-emerald-400 font-bold bg-indigo-950/20 print:bg-slate-50">✓ Incluido</td>
                  <td className="py-2 px-3 text-center text-emerald-400">✓ Con IA Avanzada</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* PIE DE PÁGINA COMPACTO */}
        <footer className="print-card bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs text-slate-400 print:text-slate-600">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400 print:text-indigo-600" />
            <span>Integración Oficial vía API de Mercado Libre. Datos 100% Cifrados.</span>
          </div>
          <div className="font-semibold text-slate-300 print:text-slate-800">
            Contacto Comercial: contacto@klyvo.app
          </div>
        </footer>

      </div>
    </div>
  );
}
