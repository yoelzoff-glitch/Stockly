"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2, RefreshCw, AlertTriangle, CheckCircle, Flame } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshMeliConnectionAction, disconnectMeliConnectionAction } from "@/actions/meli-connection";

export function MeliCard({ meliAccount, isDemo = false }: { meliAccount: any; isDemo?: boolean }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const showDemoNotice = () => {
    alert("Esta es una cuenta de demostración\n\nPodés recorrer toda la información, pero los cambios y las conexiones externas están deshabilitados.");
  };

  const handleSync = async () => {
    if (isDemo) {
      showDemoNotice();
      return;
    }
    setIsSyncing(true);
    try {
      const resProducts = await fetch("/api/meli/sync-products", { method: "POST" });
      const dataProducts = await resProducts.json();
      
      if (!resProducts.ok) {
        throw new Error(dataProducts.error || "Error al sincronizar productos");
      }

      const resOrders = await fetch("/api/meli/sync-orders", { method: "POST" });
      const dataOrders = await resOrders.json();

      if (!resOrders.ok) {
        throw new Error(dataOrders.error || "Error al sincronizar órdenes");
      }

      alert(`¡Sincronización exitosa!\n\nProductos procesados: ${dataProducts.syncedCount}\nÓrdenes procesadas: ${dataOrders.syncedCount}`);
      router.refresh();
    } catch (error: any) {
      alert(`Falló la sincronización: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualRefresh = async () => {
    if (isDemo) {
      showDemoNotice();
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await refreshMeliConnectionAction();
      if (res.success) {
        alert("¡Conexión de Mercado Libre renovada exitosamente!");
        router.refresh();
      } else {
        alert(`Error al refrescar conexión: ${res.error}`);
      }
    } catch (error: any) {
      alert(`Error al refrescar conexión: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (isDemo) {
      showDemoNotice();
      return;
    }
    const confirmed = confirm(
      "¿Estás seguro de desconectar tu cuenta de Mercado Libre?\n\nDesconectar Mercado Libre detendrá nuevas sincronizaciones, pero tus datos históricos se conservarán."
    );
    if (confirmed) {
      try {
        const res = await disconnectMeliConnectionAction();
        if (res.success) {
          alert("Cuenta desconectada. Todos tus datos históricos han sido conservados.");
          router.refresh();
        } else {
          alert(`Error al desconectar: ${res.error}`);
        }
      } catch (e: any) {
        alert(`Error al desconectar: ${e.message}`);
      }
    }
  };

  // Determine actual display state
  const isConnected = isDemo || (meliAccount && meliAccount.status === "connected");
  const isError = !isDemo && meliAccount && meliAccount.status === "error";
  const isDisconnected = !isDemo && (!meliAccount || meliAccount.status === "disconnected");

  // Calculate token expiration details
  let hoursLeft = 0;
  let isTokenExpired = false;
  if (isConnected && meliAccount?.token_expires_at) {
    const expiresAt = new Date(meliAccount.token_expires_at).getTime();
    hoursLeft = Math.max(0, Math.round((expiresAt - Date.now()) / (1000 * 60 * 60)));
    isTokenExpired = expiresAt < Date.now();
  }

  // Format last successful refresh
  const lastRefreshStr = meliAccount?.last_success_refresh 
    ? new Date(meliAccount.last_success_refresh).toLocaleString("es-AR")
    : isDemo ? "Simulado (reciente)" : "Nunca";

  return (
    <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-5 flex flex-col justify-between h-full space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCDAD4]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#FFF0A6] border border-[#E5D275] flex items-center justify-center text-[#101828]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#101828]">Mercado Libre</h3>
              <p className="text-[11px] text-[#5F6875]">Canal de Venta Principal</p>
            </div>
          </div>
          {isDemo ? (
            <StatusBadge variant="neutral">Simulación demo</StatusBadge>
          ) : isConnected ? (
            <StatusBadge variant="success">Conectado</StatusBadge>
          ) : isError ? (
            <StatusBadge variant="danger">Error</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Desconectado</StatusBadge>
          )}
        </div>

        <p className="text-xs text-[#5F6875] leading-relaxed">
          Sincronización bidireccional de publicaciones, stock disponible, ventas y costos de envío.
        </p>

        {meliAccount && !isDisconnected && (
          <div className="space-y-1.5 pt-2 border-t border-[#DCDAD4] text-xs font-mono">
            {isConnected && (
              <div className="flex justify-between items-center text-[#5F6875]">
                <span>Token de Acceso:</span>
                {isTokenExpired ? (
                  <span className="text-[#D92D20] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Expirado
                  </span>
                ) : (
                  <span className="text-[#198754] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Vigente ({hoursLeft}h restantes)
                  </span>
                )}
              </div>
            )}
            <div className="flex justify-between items-center text-[#5F6875]">
              <span>Última sincronización:</span>
              <span className="text-[#101828]">{lastRefreshStr}</span>
            </div>
            {meliAccount.sync_error && (
              <div className="bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20] p-2 rounded text-[11px] font-mono leading-tight mt-1">
                <span className="font-semibold">Error detectado:</span> {meliAccount.sync_error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[#DCDAD4] mt-auto">
        {isConnected ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSync}
                disabled={isSyncing || isRefreshing}
                className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Sincronizando
                  </>
                ) : (
                  "Sincronizar"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isSyncing || isRefreshing}
                className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Refrescar
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isSyncing || isRefreshing}
              className="w-full h-8 border-[#DCDAD4] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold"
            >
              Desconectar
            </Button>
          </div>
        ) : isError ? (
          <div className="space-y-2">
            <Link href="/api/meli/connect" className="block w-full">
              <Button size="sm" className="w-full h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold">
                Reconectar cuenta
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isSyncing || isRefreshing}
              className="w-full h-8 border-[#DCDAD4] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold"
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Link href="/api/meli/connect" className="block w-full">
            <Button size="sm" className="w-full h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold">
              Conectar Mercado Libre
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
