"use client";

import * as React from "react";
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
  Activity,
  BrainCircuit,
  Truck,
  Ban,
  DollarSign,
  Tag,
  ShoppingBag,
  Layers,
  Calculator
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Health Center", href: "/dashboard/health", icon: Activity },
  { name: "Intelligence Center", href: "/dashboard/intelligence", icon: BrainCircuit },
  { name: "Analíticas e Insights", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Productos", href: "/dashboard/products", icon: Package },
  { name: "Stock Interno", href: "/dashboard/internal-stock", icon: Layers, indent: true },
  { name: "Compras Internas", href: "/dashboard/purchases", icon: ShoppingBag, indent: true },
  { name: "Promociones", href: "/dashboard/promotions", icon: Tag },
  { name: "Ventas", href: "/dashboard/sales", icon: ShoppingCart },
  { name: "Envíos", href: "/dashboard/shipments", icon: Truck, indent: true },
  { name: "Cancelaciones", href: "/dashboard/cancellations", icon: Ban, indent: true },
  { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
  { name: "Contabilidad", href: "/dashboard/accounting", icon: Calculator, indent: true },
  { name: "Mensajes", href: "/dashboard/messages", icon: MessageSquare },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
  { name: "Integraciones", href: "/dashboard/integrations", icon: Plug, indent: true },
];

export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
        <div className="border-b border-slate-200 bg-white px-6 py-6 flex items-center justify-center w-full">
          <img src="/logo.png" alt="Klyvo Logo" className="w-full max-w-[200px] h-auto" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 bg-white">
          <nav className="flex-1 space-y-1">
            {sidebarLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "group flex items-center rounded-lg px-4 py-3 text-[15px] font-medium transition-all duration-200",
                    item.indent ? "ml-6 text-slate-500 border-l-2 border-slate-100 pl-4 py-2 text-sm" : "",
                    isActive 
                      ? (item.indent ? "bg-indigo-50/50 text-indigo-700 border-indigo-400" : "bg-indigo-50 text-indigo-700 relative")
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {!item.indent && isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-600 rounded-r-full" />
                  )}
                  <item.icon className={cn("mr-4 h-5 w-5", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
