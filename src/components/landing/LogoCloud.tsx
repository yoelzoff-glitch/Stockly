"use client";

import { motion } from "framer-motion";

export function LogoCloud() {
  return (
    <div className="py-12 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400 mb-8">
          Pensado para vendedores que viven de Mercado Libre
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 tracking-tighter">Mercado Libre</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 tracking-tighter">WhatsApp</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 tracking-tighter">OpenAI</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 tracking-tighter">Mercado Pago</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-slate-800 tracking-tighter">Supabase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
