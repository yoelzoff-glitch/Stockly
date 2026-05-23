"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Plug,
  MessageSquare,
  Settings,
  LogOut,
  Target,
  BrainCircuit,
  Activity,
  Truck,
  Ban,
  LineChart,
  DollarSign
} from "lucide-react";
import { logoutAction } from "@/actions/auth";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Guía de Inicio", href: "/dashboard/get-started", icon: Target },
  { name: "Health Center", href: "/dashboard/health", icon: Activity },
  { name: "Intelligence Center", href: "/dashboard/intelligence", icon: BrainCircuit },
  { name: "Market Insights", href: "/dashboard/market-insights", icon: LineChart },
  { name: "Ventas", href: "/dashboard/sales", icon: ShoppingCart },
  { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
  { name: "Envíos", href: "/dashboard/shipments", icon: Truck },
  { name: "Cancelaciones", href: "/dashboard/cancellations", icon: Ban },
  { name: "Productos", href: "/dashboard/products", icon: Package },
  { name: "Analíticas", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Integraciones", href: "/dashboard/integrations", icon: Plug },
  { name: "Mensajes", href: "/dashboard/messages", icon: MessageSquare },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white px-3 py-4">
      <div className="mb-8 px-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Package className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stockly</h1>
      </div>
      <nav className="flex-1 space-y-1">
        {sidebarLinks.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-700 relative" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 rounded-r-full" />
              )}
              <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
