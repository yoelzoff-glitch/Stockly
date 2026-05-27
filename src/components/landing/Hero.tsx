"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-transparent to-transparent opacity-50"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-6 text-center lg:text-left mb-16 lg:mb-0"
          >
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
              Tu cuenta de Mercado Libre en <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Piloto Automático</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Dejá de perder dinero en comisiones invisibles, quiebres de stock y títulos obsoletos. Klyvo es el copiloto operativo con IA que audita tus costos, automatiza tus operaciones masivas y optimiza tu rentabilidad 24/7.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4 mb-10">
              <Link href="/register" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                  Empezar gratis
                </Button>
              </Link>
              <Link href="#demo" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto rounded-full px-8 py-6 text-lg border-slate-300 text-slate-700 hover:bg-slate-100">
                  Ver demo
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-2 sm:space-y-0 sm:space-x-6 text-sm text-slate-500 font-medium">
              <div className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" /> Ahorrá +25hs semanales</div>
              <div className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" /> Detené fugas impositivas</div>
              <div className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" /> Integración oficial en 3 min</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden transform -rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
              </div>
              <img 
                src="/dashboard-intelligence-v2.png" 
                alt="Klyvo Dashboard Preview" 
                className="w-full h-auto object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
            </div>
            
            {/* Floating Elements for SaaS feel */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 hidden md:block"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">+18% Margen</p>
                  <p className="text-xs text-slate-500">Optimizado hoy</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
