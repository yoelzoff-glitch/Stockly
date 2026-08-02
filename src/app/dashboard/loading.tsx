"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardLoading() {
  const pathname = usePathname();
  const [moduleName, setModuleName] = useState("Klyvo");

  useEffect(() => {
    if (!pathname) return;

    if (pathname === "/dashboard") {
      setModuleName("Dashboard");
    } else if (pathname.startsWith("/dashboard/sales")) {
      setModuleName("Ventas");
    } else if (pathname.startsWith("/dashboard/finance")) {
      setModuleName("Finanzas");
    } else if (pathname.startsWith("/dashboard/accounting")) {
      setModuleName("Contabilidad");
    } else if (pathname.startsWith("/dashboard/internal-stock")) {
      setModuleName("Depósito");
    } else if (pathname.startsWith("/dashboard/products")) {
      setModuleName("Productos");
    } else if (pathname.startsWith("/dashboard/shipments")) {
      setModuleName("Envíos");
    } else if (pathname.startsWith("/dashboard/cancellations")) {
      setModuleName("Cancelaciones");
    } else if (pathname.startsWith("/dashboard/workflows")) {
      setModuleName("Automatizaciones");
    } else if (pathname.startsWith("/dashboard/integrations")) {
      setModuleName("Integraciones");
    } else if (pathname.startsWith("/dashboard/analytics")) {
      setModuleName("Analíticas");
    } else if (pathname.startsWith("/dashboard/billing")) {
      setModuleName("Plan y Facturación");
    } else if (pathname.startsWith("/dashboard/promotions")) {
      setModuleName("Promociones");
    } else if (pathname.startsWith("/dashboard/purchases")) {
      setModuleName("Compras");
    } else if (pathname.startsWith("/dashboard/messages")) {
      setModuleName("Mensajes");
    } else if (pathname.startsWith("/dashboard/notifications")) {
      setModuleName("Notificaciones");
    } else if (pathname.startsWith("/dashboard/actions")) {
      setModuleName("Acciones");
    } else if (pathname.startsWith("/dashboard/settings")) {
      setModuleName("Configuración");
    } else {
      setModuleName("Klyvo");
    }
  }, [pathname]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] h-full w-full p-8 animate-in fade-in duration-300">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin-reverse {
              to { transform: rotate(-360deg); }
            }
            .animate-spin-reverse {
              animation: spin-reverse 1.2s linear infinite;
            }
          `,
        }}
      />
      <div className="relative flex items-center justify-center mb-5">
        {/* Outer pulsing/spinning gradient ring */}
        <div className="absolute w-20 h-20 rounded-full border-[3px] border-indigo-600/10 border-t-indigo-600 animate-spin" />
        
        {/* Inner reverse spin ring */}
        <div className="absolute w-14 h-14 rounded-full border-2 border-indigo-400/5 border-b-indigo-400/60 animate-spin-reverse" />
        
        {/* Centered pulsing dot/icon */}
        <div className="w-8 h-8 rounded-full bg-indigo-50/50 flex items-center justify-center shadow-sm">
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin duration-1000" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-sm font-semibold text-slate-800 animate-pulse tracking-wide">
          Cargando {moduleName}
        </h3>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          Por favor espera
        </p>
      </div>
    </div>
  );
}
