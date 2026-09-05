"use client";

import { LogOut, User, Menu, Target } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import Link from "next/link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useState } from "react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";

export function Navbar({
  plan,
  daysRemaining,
  isDemo = false
}: {
  plan?: string;
  daysRemaining?: number | null;
  isDemo?: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-[#DCDAD4] bg-white px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-[#DCDAD4] text-[#5F6875] hover:bg-[#F5F3EE] hover:text-[#101828]"
            aria-label="Abrir navegación"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="md:hidden flex items-center">
            <img src="/logo.png" alt="Klyvo" className="h-7 w-auto" />
          </div>

          {isDemo && (
            <div className="md:hidden flex items-center">
              <span className="text-[10px] font-medium text-[#5F6875] bg-[#F5F3EE] px-2 py-0.5 rounded border border-[#DCDAD4]">
                Demo · Ficticio
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Guía de inicio */}
          <Link
            href="/dashboard/get-started"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6875] hover:text-[#101828] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#F5F3EE]"
          >
            <Target className="h-4 w-4 text-[#102A56]" />
            <span className="hidden sm:inline">Guía de Inicio</span>
          </Link>

          {/* Plan actual o Demo */}
          {isDemo ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#F5F3EE] text-[#102A56] border border-[#DCDAD4]"
                title="Cuenta demostrativa privada"
              >
                <span>Klyvo Demo</span>
              </span>
              <span className="hidden lg:inline-flex items-center text-xs font-medium text-[#5F6875] bg-[#F5F3EE]/80 px-2.5 py-1 rounded border border-[#EAE7DF]">
                Cuenta demostrativa · Los datos son ficticios
              </span>
            </div>
          ) : (
            plan && (
              <Link
                href="/dashboard/billing"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#F5F3EE] text-[#102A56] border border-[#DCDAD4] hover:bg-[#EAE7DF] transition-colors"
                title="Ver detalles de facturación"
              >
                <span className="capitalize">Klyvo {plan}</span>
                {daysRemaining !== null && daysRemaining !== undefined && (
                  <span className="text-[#5F6875]">
                    • {daysRemaining > 0 ? `${daysRemaining}d` : "Vencido"}
                  </span>
                )}
              </Link>
            )
          )}

          <div className="h-4 w-px bg-[#DCDAD4] hidden sm:block" />

          {/* Notificaciones */}
          <NotificationBell />

          {/* Usuario / Mi Cuenta */}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 text-[#5F6875] hover:text-[#101828] p-1.5 rounded-lg hover:bg-[#F5F3EE] transition-colors"
            title="Configuración de la cuenta"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F3EE] text-[#102A56] border border-[#DCDAD4]">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="hidden md:inline text-xs font-semibold text-[#101828]">Mi Cuenta</span>
          </Link>

          {/* Cerrar Sesión */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCDAD4] text-[#5F6875] hover:bg-[#F5F3EE] hover:text-[#D92D20] transition-colors cursor-pointer"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </header>

      <MobileSidebar open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
    </>
  );
}
