"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#F5F3EE]/90 backdrop-blur-md border-b border-[#DCDAD4] shadow-xs py-0"
          : "bg-[#F5F3EE] border-b border-transparent py-1.5"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 transition-all duration-300">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4] rounded-lg p-1 -m-1"
              aria-label="LibretaX inicio"
            >
              <Logo size="md" />
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav
            className="hidden md:flex items-center space-x-7 lg:space-x-8"
            aria-label="Navegación principal"
          >
            <Link
              href="#recorrido"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#5B2FE4] hover:after:rounded-full"
            >
              Producto
            </Link>
            <Link
              href="#modulos"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#5B2FE4] hover:after:rounded-full"
            >
              Funcionalidades
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#5B2FE4] hover:after:rounded-full"
            >
              Cómo funciona
            </Link>
            <Link
              href="#precios"
              className="text-sm font-medium text-[#5F6875] hover:text-[#101828] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#5B2FE4] hover:after:rounded-full"
            >
              Precios
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#5F6875] hover:text-[#101828] transition-colors px-3 py-2 rounded-lg hover:bg-[#EAE7DF]/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#102A56]"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-all shadow-xs hover:shadow-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4] focus-visible:ring-offset-2"
            >
              <span>Probar LibretaX</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg text-[#101828] hover:bg-[#EAE7DF] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#102A56]"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Accessible Mobile Menu Modal / Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-[#101828]/30 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-[#F5F3EE] border-b border-[#DCDAD4] px-6 pt-4 pb-8 space-y-6 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-3" aria-label="Navegación móvil">
              <Link
                href="#recorrido"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#101828] hover:text-[#5B2FE4] py-2 border-b border-[#DCDAD4]/60 flex items-center justify-between"
              >
                <span>Producto</span>
                <span className="text-xs font-mono text-[#5F6875]">01</span>
              </Link>
              <Link
                href="#modulos"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#101828] hover:text-[#5B2FE4] py-2 border-b border-[#DCDAD4]/60 flex items-center justify-between"
              >
                <span>Funcionalidades</span>
                <span className="text-xs font-mono text-[#5F6875]">02</span>
              </Link>
              <Link
                href="#como-funciona"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#101828] hover:text-[#5B2FE4] py-2 border-b border-[#DCDAD4]/60 flex items-center justify-between"
              >
                <span>Cómo funciona</span>
                <span className="text-xs font-mono text-[#5F6875]">03</span>
              </Link>
              <Link
                href="#precios"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#101828] hover:text-[#5B2FE4] py-2 border-b border-[#DCDAD4]/60 flex items-center justify-between"
              >
                <span>Precios</span>
                <span className="text-xs font-mono text-[#5F6875]">04</span>
              </Link>
            </nav>

            <div className="pt-2 flex flex-col space-y-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-lg text-sm font-semibold text-[#101828] bg-white border border-[#DCDAD4] hover:bg-[#EAE7DF] transition-colors"
              >
                Ingresar
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shadow-xs"
              >
                Probar LibretaX
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
