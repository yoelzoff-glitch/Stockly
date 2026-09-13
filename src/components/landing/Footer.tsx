"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ShieldCheck, Mail, ArrowUpRight } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics/ga";

export function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-white text-[#5F6875] border-t border-[#DCDAD4] py-14 lg:py-16">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-10 lg:gap-12">
          {/* Col 1: Brand & Desc (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" aria-label="LibretaX inicio" className="inline-block">
              <Logo variant="wordmark-dark" size="md" />
            </Link>
            <p className="text-sm text-[#5F6875] leading-relaxed max-w-sm">
              Plataforma para vendedores de Mercado Libre. Centralizá ventas, costos, comisiones, envíos, publicidad y stock para conocer tu rentabilidad real.
            </p>
            <div className="pt-2 text-xs text-[#102A56] font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#198754] shrink-0" />
              <span>Conexión oficial mediante Mercado Libre OAuth 2.0</span>
            </div>
            {/* Quick Social & WhatsApp links */}
            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://wa.me/5491166085798?text=Hola%20LibretaX%2C%20quisiera%20hacer%20una%20consulta"
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp Comercial LibretaX"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all shadow-2xs"
                aria-label="Escribir por WhatsApp a LibretaX"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/libretax_/"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram @libretax_"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#E1306C]/10 text-[#E1306C] hover:bg-[#E1306C] hover:text-white transition-all shadow-2xs"
                aria-label="Seguir a LibretaX en Instagram"
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61594040323699"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook LibretaX"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-white transition-all shadow-2xs"
                aria-label="Seguir a LibretaX en Facebook"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a
                href="mailto:info@libretax.com.ar"
                title="Email de Información LibretaX"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#102A56]/10 text-[#102A56] hover:bg-[#102A56] hover:text-white transition-all shadow-2xs"
                aria-label="Enviar correo a info@libretax.com.ar"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Navegación (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101828]">
              Navegación
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="#recorrido" className="hover:text-[#101828] transition-colors">
                  Recorrido
                </Link>
              </li>
              <li>
                <Link href="#modulos" className="hover:text-[#101828] transition-colors">
                  Módulos
                </Link>
              </li>
              <li>
                <Link href="#como-funciona" className="hover:text-[#101828] transition-colors">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="#precios" className="hover:text-[#101828] transition-colors">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-[#101828] transition-colors">
                  Preguntas
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Contacto & Canales (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101828]">
              Contacto & Canales
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://wa.me/5491166085798?text=Hola%20LibretaX%2C%20quisiera%20hacer%20una%20consulta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 hover:text-[#101828] transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#25D366]/10 text-[#25D366] shrink-0 mt-0.5 group-hover:bg-[#25D366] group-hover:text-white transition-colors">
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-[#101828] leading-tight">
                      11 6608-5798
                    </span>
                    <span className="text-xs text-[#5F6875] group-hover:text-[#101828]">
                      WhatsApp comercial
                    </span>
                  </div>
                </a>
              </li>

              <li>
                <a
                  href="https://www.instagram.com/libretax_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 hover:text-[#101828] transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#E1306C]/10 text-[#E1306C] shrink-0 mt-0.5 group-hover:bg-[#E1306C] group-hover:text-white transition-colors">
                    <InstagramIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-[#101828] leading-tight flex items-center gap-1">
                      @libretax_
                      <ArrowUpRight className="w-3 h-3 text-[#5F6875] group-hover:text-[#101828]" />
                    </span>
                    <span className="text-xs text-[#5F6875] group-hover:text-[#101828]">
                      Instagram oficial
                    </span>
                  </div>
                </a>
              </li>

              <li>
                <a
                  href="https://www.facebook.com/profile.php?id=61594040323699"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 hover:text-[#101828] transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#1877F2]/10 text-[#1877F2] shrink-0 mt-0.5 group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                    <FacebookIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-[#101828] leading-tight flex items-center gap-1">
                      LibretaX
                      <ArrowUpRight className="w-3 h-3 text-[#5F6875] group-hover:text-[#101828]" />
                    </span>
                    <span className="text-xs text-[#5F6875] group-hover:text-[#101828]">
                      Facebook oficial
                    </span>
                  </div>
                </a>
              </li>

              <li>
                <a
                  href="mailto:soporte@libretax.com.ar"
                  className="group flex items-start gap-2.5 hover:text-[#101828] transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#102A56]/10 text-[#102A56] shrink-0 mt-0.5 group-hover:bg-[#102A56] group-hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-[#101828] leading-tight">
                      soporte@libretax.com.ar
                    </span>
                    <span className="text-xs text-[#5F6875] group-hover:text-[#101828]">
                      Mesa de ayuda y soporte
                    </span>
                  </div>
                </a>
              </li>

              <li>
                <a
                  href="mailto:info@libretax.com.ar"
                  className="group flex items-start gap-2.5 hover:text-[#101828] transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-700 shrink-0 mt-0.5 group-hover:bg-[#102A56] group-hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="block font-semibold text-[#101828] leading-tight">
                      info@libretax.com.ar
                    </span>
                    <span className="text-xs text-[#5F6875] group-hover:text-[#101828]">
                      Consultas generales
                    </span>
                  </div>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Acceso y Legal (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101828]">
              Acceso y Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/login"
                  onClick={() => trackCTAClick("footer", "Iniciar sesión")}
                  className="hover:text-[#101828] transition-colors"
                >
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  onClick={() => trackCTAClick("footer", "Registrarse en LibretaX")}
                  className="hover:text-[#101828] transition-colors font-medium text-[#102A56]"
                >
                  Registrarse en LibretaX
                </Link>
              </li>
              <li>
                <Link href="/terminos" className="hover:text-[#101828] transition-colors">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className="hover:text-[#101828] transition-colors">
                  Políticas de privacidad
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-[#DCDAD4] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5F6875]">
          <p>
            &copy; {new Date().getFullYear()} LibretaX. Todos los derechos reservados.
          </p>
          <p className="text-center sm:text-right">
            LibretaX no está afiliado a MercadoLibre S.R.L. Integración desarrollada mediante su API pública oficial.
          </p>
        </div>
      </div>
    </footer>
  );
}
