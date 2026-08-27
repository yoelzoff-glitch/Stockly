"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles, 
  Zap, 
  CheckCircle,
  BarChart3,
  RefreshCw,
  Search,
  DollarSign,
  Package,
  Megaphone
} from "lucide-react";

export function Hero() {
  const [activeTab, setActiveTab] = useState<"margins" | "ads" | "full" | "repricer">("margins");

  return (
    <section className="relative pt-36 pb-20 lg:pt-44 lg:pb-32 overflow-hidden bg-slate-950 text-white bg-grid-pattern-dark">
      {/* Background Lighting Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-[450px] h-[350px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Monospace Tag */}
        <div className="flex justify-center mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-inner"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span className="text-amber-400 font-bold">KLYVO OS //</span>
            <span>AUDITORÍA DE ADS, STOCK FULL & MARGEN REAL</span>
          </motion.div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6"
          >
            Tu cuenta de Mercado Libre en <br className="hidden sm:inline"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-indigo-300">
              Piloto Automático Rentable
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto font-light"
          >
            Audita tus campañas de <strong className="text-white font-medium">Mercado Libre Product ADS</strong>, monitoreá tu inventario en bodegas de <strong className="text-white font-medium">Mercado Libre FULL</strong> y frená fugas de comisiones sin planillas de Excel desactualizadas.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
          >
            <Link href="/register" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-8 py-6 rounded-xl text-base shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2">
                <span>Comenzar prueba gratis</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>

            <Link href="#matriz-comparativa" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-800 px-8 py-6 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
                <span>Ver cómo funciona</span>
              </Button>
            </Link>
          </motion.div>

          {/* Micro Guarantee Bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Monitoreo de Product ADS
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Control de Stock FULL & Depósito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> 15 días gratis sin tarjeta
            </span>
          </div>
        </div>

        {/* Interactive Mock Dashboard Container */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="max-w-5xl mx-auto"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
            
            {/* Interactive Header Tabs */}
            <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60 gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">klyvo-app-v2.4.melisync</span>
              </div>

              {/* Tab Selector Buttons */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80 text-xs font-medium">
                <button
                  onClick={() => setActiveTab("margins")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeTab === "margins" 
                      ? "bg-slate-800 text-amber-400 font-semibold shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Margen Neto</span>
                </button>

                <button
                  onClick={() => setActiveTab("ads")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeTab === "ads" 
                      ? "bg-slate-800 text-amber-400 font-semibold shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Product ADS</span>
                </button>

                <button
                  onClick={() => setActiveTab("full")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeTab === "full" 
                      ? "bg-slate-800 text-amber-400 font-semibold shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Stock FULL</span>
                </button>

                <button
                  onClick={() => setActiveTab("repricer")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeTab === "repricer" 
                      ? "bg-slate-800 text-amber-400 font-semibold shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Repricer</span>
                </button>
              </div>
            </div>

            {/* Tab Display Area */}
            <div className="p-6 md:p-8 min-h-[340px]">
              <AnimatePresence mode="wait">
                
                {/* TAB 1: MARGIN AUDIT */}
                {activeTab === "margins" && (
                  <motion.div 
                    key="margins"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-mono text-slate-400">Ventas Brutas (Mes)</p>
                        <p className="text-2xl font-extrabold text-white mt-1">$ 14.850.000 ARS</p>
                        <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-mono">
                          <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs mes anterior
                        </span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-mono text-slate-400">Inversión Publicidad & Fees</p>
                        <p className="text-2xl font-extrabold text-amber-400 mt-1">-$ 3.120.000 ARS</p>
                        <span className="text-xs text-slate-400 font-mono mt-1 block">Comisiones + Product ADS</span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
                        <p className="text-xs font-mono text-emerald-400">Ganancia Limpia Real</p>
                        <p className="text-2xl font-extrabold text-emerald-400 mt-1">$ 3.840.500 ARS</p>
                        <span className="text-xs text-emerald-400 font-mono mt-1 block">25.8% Margen Neto Auditado</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Alerta de Fuga Impositiva & ADS</p>
                          <p className="text-xs text-slate-400">SKU #ML-88402 - Campaña ADS consumiendo ACOS sin margen neto positivo</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-amber-400 text-slate-950 font-bold text-xs rounded-md uppercase tracking-wider font-mono">
                        Auto-Corregido
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: MERCADO LIBRE PRODUCT ADS */}
                {activeTab === "ads" && (
                  <motion.div 
                    key="ads"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-mono text-slate-400">Inversión Publicidad ADS</p>
                        <p className="text-2xl font-extrabold text-white mt-1">$ 680.000 ARS</p>
                        <span className="text-xs text-slate-400 font-mono mt-1 block">Presupuesto diario optimizado</span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-mono text-slate-400">ACOS Objetivo vs Real</p>
                        <p className="text-2xl font-extrabold text-emerald-400 mt-1">7.4% ACOS</p>
                        <span className="text-xs text-emerald-400 font-mono mt-1 block">ROAS: 13.5x retorno</span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
                        <p className="text-xs font-mono text-emerald-400">Ventas Directas por ADS</p>
                        <p className="text-2xl font-extrabold text-emerald-400 mt-1">$ 9.180.000 ARS</p>
                        <span className="text-xs text-emerald-400 font-mono mt-1 block">Ganancia limpia descontando ad spend</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 font-mono text-xs text-slate-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-amber-400" />
                        <span>Klyvo ADS Guard: Detiene automáticamente palabras o campañas que superan tu ACOS crítico.</span>
                      </div>
                      <span className="text-amber-400 font-bold">100% Protegido</span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: STOCK FULL (FULFILLMENT) */}
                {activeTab === "full" && (
                  <motion.div 
                    key="full"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-mono text-slate-400">Unidades Físicas en Bodegas FULL</p>
                        <p className="text-2xl font-extrabold text-white mt-1">4.820 Unidades</p>
                        <span className="text-xs text-slate-400 font-mono mt-1 block">42 Publicaciones activas en MeLi Full</span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-red-500/30 bg-red-950/10">
                        <p className="text-xs font-mono text-red-400">Alertas de Stock Crítico FULL</p>
                        <p className="text-2xl font-extrabold text-red-400 mt-1">2 SKUs Críticos</p>
                        <span className="text-xs text-red-300 font-mono mt-1 block">&lt; 5 días de cobertura en bodega</span>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
                        <p className="text-xs font-mono text-emerald-400">Reposición Sugerida a Bodega</p>
                        <p className="text-2xl font-extrabold text-emerald-400 mt-1">180 Unidades</p>
                        <span className="text-xs text-emerald-400 font-mono mt-1 block">En envío para mantener la insignia FULL</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Sync Bidireccional Depósito Propio ↔ Bodegas MeLi FULL</span>
                      </div>
                      <span className="text-emerald-400 font-bold">Activo</span>
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: REPRICER */}
                {activeTab === "repricer" && (
                  <motion.div 
                    key="repricer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
                      <span>PUBLICACIÓN / SKU</span>
                      <span>PRECIO ANTERIOR</span>
                      <span>PRECIO OPTIMIZADO</span>
                      <span>ESTADO</span>
                    </div>

                    {[
                      { sku: "KIT-HERRAMIENTAS-PRO", title: "Set Juego De Llaves Combinadas 12 Pzs", oldP: "$ 48.900", newP: "$ 53.400", status: "Margen Aumentado +9%" },
                      { sku: "AURICULARES-BT-X1", title: "Auriculares Inalámbricos Bluetooth Pro", oldP: "$ 32.000", newP: "$ 29.800", status: "Ganó Buybox MeLi" },
                      { sku: "CARGADOR-RAPIDO-65W", title: "Cargador Carga Rápida Tipo C GaN", oldP: "$ 19.500", newP: "$ 21.900", status: "Ajuste por Dólar/Costo" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-colors">
                        <div className="max-w-[240px] truncate">
                          <p className="text-white font-semibold">{item.title}</p>
                          <p className="text-[10px] text-slate-500">{item.sku}</p>
                        </div>
                        <span className="text-slate-400 line-through">{item.oldP}</span>
                        <span className="text-emerald-400 font-bold text-sm">{item.newP}</span>
                        <span className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded text-[10px] font-sans">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Bottom Bar Ticker */}
            <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Sincronización automática de depósitos físicos, MeLi FULL y Product ADS activa
              </span>
              <span className="hidden md:inline text-amber-400 font-semibold">
                Soporta hasta +50.000 SKUs
              </span>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
