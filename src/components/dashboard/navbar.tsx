"use client";

import { LogOut, User } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import Link from "next/link";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Target } from "lucide-react";

export function Navbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6 lg:h-16">
      <div className="flex items-center gap-4">
        {/* Aquí podríamos agregar un breadcrumb o título dinámico si se requiere en el futuro */}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/get-started" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-indigo-600 transition-colors">
          <Target className="h-4 w-4" />
          <span className="hidden sm:inline">Guía de Inicio</span>
        </Link>
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
  );
}
