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

export function MeliCard({ meliAccount }: { meliAccount: any }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
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
  const isConnected = meliAccount && meliAccount.status === "connected";
  const isError = meliAccount && meliAccount.status === "error";
  const isDisconnected = !meliAccount || meliAccount.status === "disconnected";

  // Calculate token expiration details
  let hoursLeft = 0;
  let isTokenExpired = false;
  if (isConnected && meliAccount.token_expires_at) {
    const expiresAt = new Date(meliAccount.token_expires_at).getTime();
    hoursLeft = Math.max(0, Math.round((expiresAt - Date.now()) / (1000 * 60 * 60)));
    isTokenExpired = expiresAt < Date.now();
  }

  // Format last successful refresh
  const lastRefreshStr = meliAccount?.last_success_refresh 
    ? new Date(meliAccount.last_success_refresh).toLocaleString("es-AR")
    : "Nunca";

  return (
    <Card className="flex flex-col h-full justify-between">
      <div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Mercado Libre</CardTitle>
          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription>
            Sincroniza tus publicaciones, stock y ventas de Mercado Libre.
          </CardDescription>

          {/* Estado de conexión */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Estado de conexión:</span>
            {isConnected ? (
              <StatusBadge variant="success">Conectado</StatusBadge>
            ) : isError ? (
              <StatusBadge variant="danger">Error</StatusBadge>
            ) : (
              <StatusBadge variant="neutral">Desconectado</StatusBadge>
            )}
          </div>

          {/* Información del Token si está enlazado */}
          {meliAccount && !isDisconnected && (
            <div className="text-xs space-y-2 border-t pt-3 mt-3">
              {isConnected && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Token:</span>
                  {isTokenExpired ? (
                    <span className="text-red-500 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Expirado
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Vigente ({hoursLeft} hs restantes)
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Último refresh exitoso:</span>
                <span className="font-mono">{lastRefreshStr}</span>
              </div>
              {meliAccount.sync_error && (
                <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-2 rounded text-[11px] font-mono break-words leading-tight mt-1 border border-red-100 dark:border-red-950">
                  <span className="font-semibold">Último error:</span> {meliAccount.sync_error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </div>

      <CardContent className="border-t pt-4 bg-muted/5 flex flex-col gap-2 mt-auto">
        {isConnected ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSync}
                disabled={isSyncing || isRefreshing}
                className="w-full"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Sincronizando
                  </>
                ) : (
                  "Sincronizar"
                )}
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleManualRefresh}
                disabled={isSyncing || isRefreshing}
                className="w-full flex items-center justify-center gap-1"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refrescar
              </Button>
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDisconnect}
              disabled={isSyncing || isRefreshing}
              className="w-full"
            >
              Desconectar
            </Button>
          </div>
        ) : isError ? (
          <div className="flex flex-col gap-2 w-full">
            <Link href="/api/meli/connect" className="w-full">
              <Button variant="default" size="sm" className="w-full flex items-center justify-center gap-1">
                <Flame className="w-4 h-4" />
                Reconectar cuenta
              </Button>
            </Link>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDisconnect}
              disabled={isSyncing || isRefreshing}
              className="w-full"
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Link href="/api/meli/connect" className="w-full">
            <Button variant="default" size="sm" className="w-full">
              Conectar Mercado Libre
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
