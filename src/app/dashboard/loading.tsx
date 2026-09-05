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
    <div className="flex flex-col items-center justify-center min-h-[50vh] h-full w-full p-8">
      <div className="flex items-center justify-center mb-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#DCDAD4] border-t-[#102A56] animate-spin flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-[#102A56]" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <h3 className="text-xs font-bold text-[#101828] tracking-wide">
          Cargando {moduleName}...
        </h3>
        <p className="text-[11px] text-[#5F6875]">
          Recuperando datos operativos
        </p>
      </div>
    </div>
  );
}
