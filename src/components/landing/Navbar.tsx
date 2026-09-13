"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { trackCTAClick } from "@/lib/analytics/ga";

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
          ? "bg-white/95 backdrop-blur-md border-b border-[rgba(0,57,104,0.12)] shadow-xs py-0"
          : "bg-white border-b border-[rgba(0,57,104,0.08)] shadow-2xs py-1.5"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 transition-all duration-300">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB] rounded-lg p-1 -m-1"
              aria-label="LibretaX inicio"
            >
              <Logo variant="wordmark-dark" size="md" />
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav
            className="hidden md:flex items-center space-x-7 lg:space-x-8"
            aria-label="Navegación principal"
          >
            <Link
              href="#recorrido"
              className="text-sm font-medium text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#00DFDB] hover:after:rounded-full"
            >
              Producto
            </Link>
            <Link
              href="#modulos"
              className="text-sm font-medium text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#00DFDB] hover:after:rounded-full"
            >
              Funcionalidades
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm font-medium text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#00DFDB] hover:after:rounded-full"
            >
              Cómo funciona
            </Link>
            <Link
              href="#precios"
              className="text-sm font-medium text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] transition-colors relative py-1 hover:after:content-[''] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:w-full hover:after:h-[2px] hover:after:bg-[#00DFDB] hover:after:rounded-full"
            >
              Precios
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            <Link
              href="/login"
              onClick={() => trackCTAClick("navbar", "Ingresar")}
              className="text-sm font-semibold text-[#003968] hover:text-[#002B4D] transition-colors px-3 py-2 rounded-lg hover:bg-[rgba(0,57,104,0.05)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB]"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              onClick={() => trackCTAClick("navbar", "Probar LibretaX")}
              className="group inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#003968] hover:bg-[#002B4D] transition-all shadow-xs hover:shadow-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB] focus-visible:ring-offset-2"
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
              className="p-2.5 rounded-lg text-[#002B4D] hover:bg-[rgba(0,57,104,0.05)] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00DFDB]"
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
        <div className="fixed inset-0 top-16 sm:top-20 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-[#002B4D]/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white border-b border-[rgba(0,57,104,0.12)] px-6 pt-4 pb-8 space-y-6 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-3" aria-label="Navegación móvil">
              <Link
                href="#recorrido"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#002B4D] hover:text-[#00DFDB] py-2 border-b border-[rgba(0,57,104,0.08)] flex items-center justify-between"
              >
                <span>Producto</span>
                <span className="text-xs font-mono text-[rgba(0,43,77,0.50)]">01</span>
              </Link>
              <Link
                href="#modulos"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#002B4D] hover:text-[#00DFDB] py-2 border-b border-[rgba(0,57,104,0.08)] flex items-center justify-between"
              >
                <span>Funcionalidades</span>
                <span className="text-xs font-mono text-[rgba(0,43,77,0.50)]">02</span>
              </Link>
              <Link
                href="#como-funciona"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#002B4D] hover:text-[#00DFDB] py-2 border-b border-[rgba(0,57,104,0.08)] flex items-center justify-between"
              >
                <span>Cómo funciona</span>
                <span className="text-xs font-mono text-[rgba(0,43,77,0.50)]">03</span>
              </Link>
              <Link
                href="#precios"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#002B4D] hover:text-[#00DFDB] py-2 border-b border-[rgba(0,57,104,0.08)] flex items-center justify-between"
              >
                <span>Precios</span>
                <span className="text-xs font-mono text-[rgba(0,43,77,0.50)]">04</span>
              </Link>
            </nav>

            <div className="pt-2 flex flex-col space-y-3">
              <Link
                href="/login"
                onClick={() => {
                  trackCTAClick("navbar_mobile", "Ingresar");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-3 rounded-lg text-sm font-semibold text-[#003968] bg-[rgba(0,57,104,0.04)] border border-[rgba(0,57,104,0.12)] hover:bg-[rgba(0,57,104,0.08)] transition-colors"
              >
                Ingresar
              </Link>
              <Link
                href="/register"
                onClick={() => {
                  trackCTAClick("navbar_mobile", "Probar LibretaX");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-3 rounded-lg text-sm font-semibold text-white bg-[#003968] hover:bg-[#002B4D] transition-colors shadow-xs"
              >
                Probar LibretaX
              </Link>

              <div className="pt-2 border-t border-[rgba(0,57,104,0.08)] flex items-center justify-between text-xs text-[rgba(0,43,77,0.70)]">
                <span>WhatsApp comercial:</span>
                <a
                  href="https://wa.me/5491166085798?text=Hola%20LibretaX%2C%20quisiera%20hacer%20una%20consulta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#003968] hover:text-[#00DFDB] hover:underline"
                >
                  11 6608-5798
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
