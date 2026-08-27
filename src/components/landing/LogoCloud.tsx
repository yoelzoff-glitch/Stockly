"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap, Lock, Cpu, Server } from "lucide-react";

export function LogoCloud() {
  return (
    <section className="py-10 bg-slate-900 border-y border-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
          
          <div className="flex items-center gap-3 justify-center pt-4 md:pt-0">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-mono">+1.2M Operaciones</p>
              <p className="text-xs text-slate-400">Procesadas en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center pt-4 md:pt-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-mono">OAuth 2.0 Oficial</p>
              <p className="text-xs text-slate-400">Mercado Libre Integration</p>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center pt-4 md:pt-0">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-mono">Motor GPT-4o / MeLi</p>
              <p className="text-xs text-slate-400">Modelos entrenados en ventas</p>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center pt-4 md:pt-0">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-mono">Multi-Cuenta Ready</p>
              <p className="text-xs text-slate-400">Sync unificado de catálogo</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
