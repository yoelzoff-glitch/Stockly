import Link from "next/link";
import { PauseCircle, Mail, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cuenta Temporalmente Pausada | LibretaX",
  description: "El acceso a LibretaX se encuentra suspendido temporalmente.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPausedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] p-4 font-sans text-[#101828]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#DCDAD4] shadow-xl p-8 text-center space-y-6">
        {/* Brand Logo */}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {/* Brand Icon & Pause Badge */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706] shadow-sm">
            <PauseCircle className="w-9 h-9" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
            Acceso Suspendido
          </div>
        </div>

        {/* Messaging */}
        <div className="space-y-2.5">
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Tu cuenta está temporalmente pausada
          </h1>
          <p className="text-sm text-[#5F6875] leading-relaxed">
            El acceso a tu espacio de trabajo en LibretaX se encuentra suspendido temporalmente.
          </p>
        </div>

        {/* Safety & Preservation Notice */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-left flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
          <div className="text-xs text-[#475569] leading-relaxed">
            <strong className="text-[#0F172A] font-semibold block">Tus datos están protegidos</strong>
            Toda tu información de ventas, productos, costos y la vinculación con Mercado Libre permanecen guardadas con total seguridad.
          </div>
        </div>

        {/* Call to actions */}
        <div className="space-y-3 pt-2">
          <a
            href="mailto:soporte@libretax.com.ar?subject=Reactivaci%C3%B3n%20de%20cuenta%20LibretaX"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shadow-sm"
          >
            <Mail className="w-4 h-4" />
            <span>Contactar a Soporte</span>
          </a>

          <Link
            href="/logout"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8]">
          ¿Tenés dudas sobre tu estado? Escribinos a{" "}
          <a
            href="mailto:soporte@libretax.com.ar"
            className="font-semibold text-[#3A86FF] hover:underline"
          >
            soporte@libretax.com.ar
          </a>
        </div>
      </div>
    </div>
  );
}
