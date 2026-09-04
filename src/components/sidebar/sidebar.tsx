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
  Truck,
  Ban,
  DollarSign,
  Tag,
  ShoppingBag,
  Layers,
  Calculator,
  Megaphone,
} from "lucide-react";

interface NavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: any;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Ventas", href: "/dashboard/sales", icon: ShoppingCart },
      { name: "Envíos", href: "/dashboard/shipments", icon: Truck },
      { name: "Cancelaciones", href: "/dashboard/cancellations", icon: Ban },
    ],
  },
  {
    label: "Catálogo & Stock",
    items: [
      { name: "Productos", href: "/dashboard/products", icon: Package },
      { name: "Stock Interno", href: "/dashboard/internal-stock", icon: Layers },
      { name: "Compras Internas", href: "/dashboard/purchases", icon: ShoppingBag },
    ],
  },
  {
    label: "Rentabilidad & Mkt",
    items: [
      { name: "Analíticas e Insights", href: "/dashboard/analytics", icon: BarChart3 },
      { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
      { name: "Contabilidad", href: "/dashboard/accounting", icon: Calculator },
      { name: "Promociones", href: "/dashboard/promotions", icon: Tag },
      { name: "Mercado Libre ADS", href: "/dashboard/ads", icon: Megaphone },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageSquare },
      { name: "Integraciones", href: "/dashboard/integrations", icon: Plug },
      { name: "Configuración", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[#DCDAD4] bg-white">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center border-b border-[#DCDAD4] shrink-0">
        <Link href="/dashboard" className="flex items-center" aria-label="Ir al Dashboard">
          <img src="/logo.png" alt="Klyvo" className="h-9 w-auto" />
        </Link>
      </div>

      {/* Structured Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6875] px-3 block">
              {group.label}
            </span>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors",
                      isActive
                        ? "bg-[#F5F3EE] text-[#101828] font-bold border-l-2 border-[#102A56]"
                        : "text-[#5F6875] hover:bg-[#F5F3EE]/60 hover:text-[#101828] font-medium"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-[#102A56]" : "text-[#5F6875]"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
