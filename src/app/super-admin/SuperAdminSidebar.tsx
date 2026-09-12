"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Layers,
  DollarSign,
  UserMinus,
  Activity,
  BarChart3,
  ArrowLeft,
  ShieldCheck,
  Inbox,
} from "lucide-react";

interface SuperAdminSidebarProps {
  adminEmail: string;
  adminRole: string;
}

const navItems = [
  { name: "Overview", href: "/super-admin", icon: LayoutDashboard },
  { name: "Leads", href: "/super-admin/leads", icon: Inbox },
  { name: "Clientes", href: "/super-admin/customers", icon: Users },
  { name: "Suscripciones", href: "/super-admin/subscriptions", icon: CreditCard },
  { name: "Planes", href: "/super-admin/plans", icon: Layers },
  { name: "Revenue", href: "/super-admin/revenue", icon: DollarSign },
  { name: "Cancelaciones", href: "/super-admin/cancellations", icon: UserMinus },
  { name: "Actividad", href: "/super-admin/activity", icon: Activity },
  { name: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
];

export function SuperAdminSidebar({ adminEmail, adminRole }: SuperAdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[#E2E8F0] bg-[#0B132B] text-[#E2E8F0] shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#1C2541] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3A86FF] flex items-center justify-center text-white font-black text-sm shadow-md">
            LX
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
              LibretaX
              <span className="text-[9px] bg-[#3A86FF]/20 text-[#3A86FF] font-black px-1.5 py-0.5 rounded border border-[#3A86FF]/30">
                ADMIN
              </span>
            </div>
            <div className="text-[10px] text-[#94A3B8]">Plataforma SaaS</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-3 block mb-2">
          Gestión Global
        </span>
        {navItems.map((item) => {
          const isActive =
            item.href === "/super-admin"
              ? pathname === "/super-admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all",
                isActive
                  ? "bg-[#3A86FF] text-white font-semibold shadow-sm"
                  : "text-[#94A3B8] hover:bg-[#1C2541] hover:text-white font-medium"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-white" : "text-[#94A3B8]"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1C2541] bg-[#0A1024] space-y-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-[#1C2541] border border-[#3A86FF]/40 flex items-center justify-center text-[#3A86FF]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{adminEmail}</div>
            <div className="text-[10px] text-[#3A86FF] uppercase font-bold tracking-wider">
              {adminRole}
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#1C2541] hover:bg-[#253256] text-[#94A3B8] hover:text-white text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Tenant</span>
        </Link>
      </div>
    </aside>
  );
}
