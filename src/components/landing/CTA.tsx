"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative py-24 bg-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-600/40 via-slate-900 to-slate-900"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
          Dejá de administrar publicaciones.<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Empezá a administrar un negocio.
          </span>
        </h2>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Únete a los vendedores que ya están escalando sus ventas y márgenes con la ayuda de Stockly.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Link href="/register" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
              Empezar gratis
            </Button>
          </Link>
          <Link href="#demo" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto rounded-full px-8 py-6 text-lg border-slate-600 text-white hover:bg-slate-800 bg-transparent">
              Agendar demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
