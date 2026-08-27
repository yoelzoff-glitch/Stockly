"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 py-12 lg:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          
          <div className="col-span-2 lg:col-span-2">
            <img src="/logo.png" alt="Klyvo Logo" className="h-12 w-auto mb-6" />
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm font-light">
              Plataforma de inteligencia operativa y auditoría financiera 24/7 para vendedores profesionales de Mercado Libre.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Sincronización oficial Mercado Libre OAuth 2.0
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase mb-4">Plataforma</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="#matriz-comparativa" className="hover:text-amber-400 transition-colors">Por qué Klyvo</Link></li>
              <li><Link href="#capacidades" className="hover:text-amber-400 transition-colors">Módulos IA</Link></li>
              <li><Link href="#calculadora" className="hover:text-amber-400 transition-colors">Calculadora ROI</Link></li>
              <li><Link href="#precios" className="hover:text-amber-400 transition-colors">Planes y Precios</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase mb-4">Soporte</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="#faq" className="hover:text-amber-400 transition-colors">Preguntas Frecuentes</Link></li>
              <li><Link href="https://calendly.com/klyvo-demo" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Agendar Demo</Link></li>
              <li><Link href="/login" className="hover:text-amber-400 transition-colors">Ingresar al Panel</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase mb-4">Legal</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/privacidad" className="hover:text-amber-400 transition-colors">Políticas de Privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-amber-400 transition-colors">Términos del Servicio</Link></li>
            </ul>
          </div>

        </div>

        <div className="mt-12 border-t border-slate-900 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} Klyvo OS. Todos los derechos reservados.
          </p>
          <p className="mt-2 sm:mt-0 text-[10px]">
            No afiliado a MercadoLibre S.R.L. Integrador oficial API REST.
          </p>
        </div>
      </div>
    </footer>
  );
}
