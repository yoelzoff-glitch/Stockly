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
  BrainCircuit,
  Target,
  Activity
} from "lucide-react";
import { logoutAction } from "@/actions/auth";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Guía de Inicio", href: "/dashboard/get-started", icon: Target },
  { name: "Health Center", href: "/dashboard/health", icon: Activity },
  { name: "Intelligence Center", href: "/dashboard/intelligence", icon: BrainCircuit },
  { name: "Competencia", href: "/dashboard/competition", icon: Target },
  { name: "Ventas", href: "/dashboard/sales", icon: ShoppingCart },
  { name: "Productos", href: "/dashboard/products", icon: Package },
  { name: "Analíticas", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Integraciones", href: "/dashboard/integrations", icon: Plug },
  { name: "Mensajes", href: "/dashboard/messages", icon: MessageSquare },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card px-3 py-4">
      <div className="mb-8 px-4">
        <h1 className="text-2xl font-bold tracking-tight">Stockly</h1>
      </div>
      <nav className="flex-1 space-y-1">
        {sidebarLinks.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
