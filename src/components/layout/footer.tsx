"use client";

import { BarChart3, Package, MessageSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-8 mx-4 md:mx-8 mb-4">
      <div className="bg-[#0b1121] rounded-2xl text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 shadow-xl border border-slate-800">

        {/* Left Side: Logo & Slogan */}
        <div className="flex items-center gap-4 flex-1">
          <img src="/logo%20blanco.png" alt="Stockly Logo Blanco" className="h-16 w-auto object-contain" />
          <div className="flex flex-col border-l border-white/20 pl-4">
            <p className="text-slate-400 text-sm leading-snug">
              Tu negocio, en datos.<br />
              Decisiones, en segundos.
            </p>
          </div>
        </div>

        {/* Right Side: Icons Equation */}
        <div className="flex items-center gap-3 md:gap-6 opacity-90 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <div className="flex flex-col items-center gap-2 min-w-max">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
            </div>
            <span className="text-[10px] md:text-xs text-slate-400 font-medium">Datos</span>
          </div>

          <span className="text-slate-500 font-light text-lg md:text-xl">+</span>

          <div className="flex flex-col items-center gap-2 min-w-max">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <span className="text-[10px] md:text-xs text-slate-400 font-medium">Inventario</span>
          </div>

          <span className="text-slate-500 font-light text-lg md:text-xl">+</span>

          <div className="flex flex-col items-center gap-2 min-w-max">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
            </div>
            <span className="text-[10px] md:text-xs text-slate-400 font-medium">IA</span>
          </div>

          <span className="text-slate-500 font-light text-lg md:text-xl ml-2 mr-2">=</span>

          <div className="flex items-center justify-center min-w-max">
            <img src="/icono.png" alt="Stockly Icon" className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow-md" />
          </div>
        </div>

      </div>
    </footer>
  );
}
