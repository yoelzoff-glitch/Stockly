"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#F5F3EE]/95 backdrop-blur-xs border-b border-[#DCDAD4]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center" aria-label="Klyvo inicio">
              <img
                src="/logo.png"
                alt="Klyvo"
                className="h-11 md:h-12 w-auto"
              />
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-8" aria-label="Navegación principal">
            <Link
              href="#recorrido"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors"
            >
              Producto
            </Link>
            <Link
              href="#modulos"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors"
            >
              Funcionalidades
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors"
            >
              Cómo funciona
            </Link>
            <Link
              href="#precios"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors"
            >
              Precios
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#5F6875] hover:text-[#101828] transition-colors px-3 py-2"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shadow-xs"
            >
              Probar Klyvo
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#101828] hover:bg-[#EAE7DF] transition-colors focus:outline-hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Accessible Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#DCDAD4] bg-[#F5F3EE] px-4 pt-2 pb-6 space-y-4 shadow-sm">
          <nav className="flex flex-col space-y-3 pt-2" aria-label="Navegación móvil">
            <Link
              href="#recorrido"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#101828] hover:text-[#102A56] py-1"
            >
              Producto
            </Link>
            <Link
              href="#modulos"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#101828] hover:text-[#102A56] py-1"
            >
              Funcionalidades
            </Link>
            <Link
              href="#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#101828] hover:text-[#102A56] py-1"
            >
              Cómo funciona
            </Link>
            <Link
              href="#precios"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#101828] hover:text-[#102A56] py-1"
            >
              Precios
            </Link>
          </nav>

          <div className="pt-4 border-t border-[#DCDAD4] flex flex-col space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-lg text-sm font-semibold text-[#101828] bg-white border border-[#DCDAD4]"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-lg text-sm font-semibold text-white bg-[#102A56]"
            >
              Probar Klyvo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
