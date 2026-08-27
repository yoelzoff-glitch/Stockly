"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Top micro announcement bar */}
      <div className="bg-slate-950 text-slate-300 text-[11px] py-1.5 px-4 text-center font-mono border-b border-slate-800/80 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          API Mercado Libre 100% Sync
        </span>
        <span className="text-slate-600">|</span>
        <span className="hidden sm:inline text-slate-400">Plazas de tarifa de lanzamiento activas (2/15)</span>
        <Link href="#precios" className="text-amber-400 hover:underline inline-flex items-center gap-0.5 ml-1 font-semibold">
          Asegurar precio <ArrowRight className="w-3 h-3 inline" />
        </Link>
      </div>

      {/* Main glass navigation bar */}
      <nav className="glass-panel border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Brand Logo & Tag */}
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center gap-2 group">
                <img src="/logo.png" alt="Klyvo Logo" className="h-12 md:h-14 w-auto transition-transform group-hover:scale-105" />
              </Link>
              <span className="hidden lg:inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                MeLi Copilot v2.4
              </span>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#matriz-comparativa" className="text-slate-600 hover:text-slate-950 font-medium text-xs uppercase tracking-wider transition-colors">
                Por qué Klyvo
              </Link>
              <Link href="#capacidades" className="text-slate-600 hover:text-slate-950 font-medium text-xs uppercase tracking-wider transition-colors">
                Módulos IA
              </Link>
              <Link href="#calculadora" className="text-slate-600 hover:text-slate-950 font-medium text-xs uppercase tracking-wider transition-colors">
                Calculadora ROI
              </Link>
              <Link href="#precios" className="text-slate-600 hover:text-slate-950 font-medium text-xs uppercase tracking-wider transition-colors">
                Precios
              </Link>
              <Link href="#faq" className="text-slate-600 hover:text-slate-950 font-medium text-xs uppercase tracking-wider transition-colors">
                FAQ
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <Link href="/login" className="text-slate-700 hover:text-slate-950 font-semibold text-sm transition-colors px-3 py-2">
                Ingresar
              </Link>

              <Link href="/register">
                <Button className="bg-slate-950 hover:bg-slate-800 text-white rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 border border-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Probar gratis</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
