"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { manualSyncShipmentsAction } from "./actions";

export function SyncShipmentsButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      await manualSyncShipmentsAction();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#DCDAD4] bg-[#FFFFFF] text-[#101828] hover:bg-[#F5F3EE] transition-colors disabled:opacity-50 cursor-pointer"
      title="Sincronizar envíos con Mercado Libre"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      <span>{loading ? "Actualizando..." : "Actualizar envíos"}</span>
    </button>
  );
}
