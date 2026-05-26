"use client";

import { LogOut, User, Menu, Target, Package } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import Link from "next/link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useState } from "react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";

export function Navbar({ plan, daysRemaining }: { plan?: string, daysRemaining?: number | null }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getPlanBadge = () => {
    if (!plan) return null;
    
    let planColor = "bg-slate-100 text-slate-700";
    if (plan === "pro") planColor = "bg-indigo-100 text-indigo-700";
    if (plan === "ultra") planColor = "bg-fuchsia-100 text-fuchsia-700";
    
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${planColor}`}>
        <span className="capitalize">Stockly {plan}</span>
        {daysRemaining !== null && daysRemaining !== undefined && (
          <span className="opacity-80">
            • {daysRemaining > 0 ? `Renueva en ${daysRemaining} d${daysRemaining === 1 ? 'ía' : 'ías'}` : 'Vencido'}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6 lg:h-16 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-md border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="md:hidden flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-indigo-600 flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-slate-900">Stockly</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/dashboard/get-started" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-indigo-600 transition-colors">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Guía de Inicio</span>
          </Link>
          <div className="hidden sm:block border-l h-5 border-slate-200 mx-1"></div>
          {getPlanBadge()}
          <NotificationBell />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden flex-col md:flex">
              <span className="text-sm font-medium leading-none">Mi Cuenta</span>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <MobileSidebar open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
    </>
  );
}
