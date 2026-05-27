"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/">
              <img src="/logo.png" alt="Klyvo Logo" className="h-8 w-auto" />
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link href="#solucion" className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">
              Solución
            </Link>
            <Link href="#como-funciona" className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">
              Cómo funciona
            </Link>
            <Link href="#precios" className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">
              Precios
            </Link>
            <Link href="#faq" className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">
              FAQ
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            {/* On Mobile: Styled Button for Login. On Desktop: Text Link */}
            <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors md:mr-2 flex items-center">
              <span className="hidden md:inline">Ingresar</span>
              <Button variant="outline" className="md:hidden border-slate-300 text-slate-700 rounded-full px-4 h-9 text-xs font-semibold hover:bg-slate-50">
                Ingresar
              </Button>
            </Link>

            {/* On Mobile: Hidden. On Desktop: Primary Indigo Button for Register */}
            <Link href="/register" className="hidden md:inline-block">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 shadow-sm">
                Empezar gratis
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
