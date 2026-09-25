"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2, RefreshCw, AlertTriangle, CheckCircle, Flame, Clock, Activity, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshMeliConnectionAction, disconnectMeliConnectionAction, retryMeliOrdersSyncAction } from "@/actions/meli-connection";
import { trackConnectMercadoLibre } from "@/lib/analytics/ga";

export interface MeliCardProps {
  meliAccount: {
    id: string;
    status: string;
    token_expires_at: string | null;
    sync_error: string | null;
    last_success_refresh: string | null;
    last_sync_at: string | null;
    retry_count?: number;
    next_retry_at?: string | null;
    last_failure_category?: string | null;
    last_failure_reason?: string | null;
    updated_at?: string | null;
  } | null;
  syncState?: {
    last_successful_sync_at: string | null;
    updated_at?: string;
  } | null;
  healthMetrics?: {
    lastOrderDate?: string | null;
    deadLetterCount?: number;
    retryCount?: number;
  } | null;
  isDemo?: boolean;
}

export function MeliCard({
  meliAccount,
  syncState,
  healthMetrics,
  isDemo = false,
}: MeliCardProps) {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const showDemoNotice = () => {
    alert("Esta es una cuenta de demostración\n\nPodés recorrer toda la información, pero los cambios y las conexiones externas están deshabilitados.");
  };

  const handleSyncOrdersOnly = async () => {
    if (isDemo) {
      showDemoNotice();
      return;
    }
    setIsSyncingOrders(true);
    try {
      const res = await retryMeliOrdersSyncAction();
      if (res.success) {
        alert(res.message);
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (error: any) {
      alert(`Error al reintentar ventas: ${error.message}`);
    } finally {
      setIsSyncingOrders(false);
    }
  };

  const handleSyncAll = async () => {
    if (isDemo) {
      showDemoNotice();
      return;
    }
    setIsSyncingAll(true);
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
      setIsSyncingAll(false);
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
  const isDisconnected = !isDemo && (!meliAccount || meliAccount.status === "disconnected");

  // Token expiration details
  let hoursLeft = 0;
  let isTokenExpired = false;
  if (meliAccount?.token_expires_at) {
    const expiresAt = new Date(meliAccount.token_expires_at).getTime();
    hoursLeft = Math.max(0, Math.round((expiresAt - Date.now()) / (1000 * 60 * 60)));
    isTokenExpired = expiresAt < Date.now();
  }

  // Transient rate limit / network error classification
  const isTransientFailure = Boolean(
    !isDemo &&
    (
      meliAccount?.last_failure_category === "transient_rate_limit" ||
      meliAccount?.last_failure_category === "transient_network" ||
      (meliAccount?.sync_error && /429|local_rate_limited|rate_limit|rate limit|limitando temporalmente|timeout|servidor/i.test(meliAccount.sync_error))
    )
  );

  const isPermanentError = Boolean(
    !isDemo &&
    meliAccount &&
    meliAccount.status === "error" &&
    !isTransientFailure
  );

  // Sales watermark lag calculation (15+ min is delayed)
  const lastSalesSyncAt = syncState?.last_successful_sync_at || meliAccount?.last_sync_at;
  const salesLagMinutes = lastSalesSyncAt
    ? Math.round((Date.now() - new Date(lastSalesSyncAt).getTime()) / (1000 * 60))
    : null;
  const isSalesLagged = Boolean(
    !isDemo &&
    !isDisconnected &&
    !isPermanentError &&
    salesLagMinutes !== null &&
    salesLagMinutes > 20
  );

  const isConnected = isDemo || (meliAccount && meliAccount.status === "connected" && !isTransientFailure && !isTokenExpired);

  // Format timestamps
  const lastTokenRefreshStr = meliAccount?.last_success_refresh 
    ? new Date(meliAccount.last_success_refresh).toLocaleString("es-AR")
    : isDemo ? "Simulado (reciente)" : "Nunca";

  const lastSalesSyncStr = lastSalesSyncAt
    ? new Date(lastSalesSyncAt).toLocaleString("es-AR")
    : isDemo ? "Simulado (reciente)" : "Sin ventas sincronizadas";

  const nextRetryStr = meliAccount?.next_retry_at
    ? new Date(meliAccount.next_retry_at).toLocaleTimeString("es-AR")
    : null;

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
          ) : isPermanentError ? (
            <StatusBadge variant="danger">Requiere reconexión</StatusBadge>
          ) : isTransientFailure ? (
            <StatusBadge variant="warning">Reintentando automáticamente</StatusBadge>
          ) : isTokenExpired ? (
            <StatusBadge variant="warning">Token por renovar</StatusBadge>
          ) : isSalesLagged ? (
            <StatusBadge variant="warning">Sincronización atrasada</StatusBadge>
          ) : isConnected ? (
            <StatusBadge variant="success">Conectado</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Desconectado</StatusBadge>
          )}
        </div>

        <p className="text-xs text-[#5F6875] leading-relaxed">
          Sincronización continua de ventas, reconciliación automática de webhooks y gestión de tokens.
        </p>

        {meliAccount && !isDisconnected && (
          <div className="space-y-2.5 pt-2 border-t border-[#DCDAD4] text-xs">
            {/* Separate Line 1: Token Authorization Status */}
            <div className="flex justify-between items-center text-[#5F6875] font-mono">
              <span>Autorización OAuth:</span>
              {isTokenExpired ? (
                <span className="text-[#D92D20] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Expirado
                </span>
              ) : (
                <span className="text-[#198754] font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Vigente ({hoursLeft}h restantes)
                </span>
              )}
            </div>

            {/* Separate Line 2: Last Token Refresh */}
            <div className="flex justify-between items-center text-[#5F6875] font-mono">
              <span>Última renovación token:</span>
              <span className="text-[#101828] font-medium">{lastTokenRefreshStr}</span>
            </div>

            {/* Separate Line 3: Last Sales Sync (from sync_state) */}
            <div className="flex justify-between items-center text-[#5F6875] font-mono">
              <span>Última sinc. de ventas:</span>
              <div className="text-right">
                <span className="text-[#101828] font-medium">{lastSalesSyncStr}</span>
                {isSalesLagged && (
                  <p className="text-[10px] text-[#D97706] font-sans font-semibold">
                    Atraso detectado: {salesLagMinutes}m
                  </p>
                )}
              </div>
            </div>

            {/* Operational Metrics Subpanel */}
            {healthMetrics && (
              <div className="bg-[#F8F9FA] rounded p-2 border border-[#E9ECEF] space-y-1 text-[11px] text-[#495057]">
                <div className="flex justify-between">
                  <span>Última orden registrada:</span>
                  <span className="font-semibold text-[#212529]">
                    {healthMetrics.lastOrderDate
                      ? new Date(healthMetrics.lastOrderDate).toLocaleString("es-AR")
                      : "Sin registros"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Eventos en dead-letter:</span>
                  <span className={`font-semibold ${healthMetrics.deadLetterCount && healthMetrics.deadLetterCount > 0 ? "text-[#D92D20]" : "text-[#198754]"}`}>
                    {healthMetrics.deadLetterCount ?? 0}
                  </span>
                </div>
                {Boolean(meliAccount.retry_count && meliAccount.retry_count > 0) && (
                  <div className="flex justify-between">
                    <span>Reintentos transitorios:</span>
                    <span className="font-semibold text-[#D97706]">{meliAccount.retry_count}</span>
                  </div>
                )}
              </div>
            )}

            {/* Transient Rate Limit Warning */}
            {isTransientFailure && (
              <div className="bg-[#FFF9EB] border border-[#F2C94C] text-[#7A4100] p-2.5 rounded text-xs leading-relaxed mt-1 flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#7A4100]">Reintentando automáticamente</p>
                  <p className="text-[11px] text-[#7A4100]/90 mt-0.5">
                    {meliAccount.last_failure_reason || "Mercado Libre está respondiendo con rate limit temporal."}
                    {nextRetryStr && ` Próximo reintento estimado: ${nextRetryStr}.`}
                  </p>
                </div>
              </div>
            )}

            {/* Permanent Error Warning */}
            {isPermanentError && (
              <div className="bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20] p-2.5 rounded text-xs leading-relaxed mt-1 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#912018]">Requiere reconexión</p>
                  <p className="text-[11px] text-[#D92D20] mt-0.5 font-mono">
                    {meliAccount.last_failure_reason || meliAccount.sync_error || "La autorización fue invalidada."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[#DCDAD4] mt-auto">
        {!isDisconnected && !isPermanentError ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Authenticated isolated orders sync retry button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncOrdersOnly}
                disabled={isSyncingOrders || isSyncingAll || isRefreshing}
                className="h-8 border-[#102A56] bg-[#102A56] text-white hover:bg-[#102A56]/90 text-xs font-semibold"
                title="Sincroniza únicamente ventas y órdenes sin barrido pesado de publicaciones"
              >
                {isSyncingOrders ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Buscando ventas
                  </>
                ) : (
                  "Sincronizar ventas"
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isSyncingOrders || isSyncingAll || isRefreshing}
                className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Refrescar token
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncAll}
                disabled={isSyncingOrders || isSyncingAll || isRefreshing}
                className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#5F6875] hover:bg-[#F5F3EE]"
                title="Sincronizar catálogo y ventas completo"
              >
                {isSyncingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Sincronizar todo"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isSyncingOrders || isSyncingAll || isRefreshing}
                className="h-8 border-[#DCDAD4] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold"
              >
                Desconectar
              </Button>
            </div>
          </div>
        ) : isPermanentError ? (
          <div className="space-y-2">
            <Link href="/api/meli/connect" onClick={() => trackConnectMercadoLibre()} className="block w-full">
              <Button size="sm" className="w-full h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold">
                Reconectar cuenta
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isSyncingOrders || isSyncingAll || isRefreshing}
              className="w-full h-8 border-[#DCDAD4] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold"
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Link href="/api/meli/connect" onClick={() => trackConnectMercadoLibre()} className="block w-full">
            <Button size="sm" className="w-full h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold">
              Conectar Mercado Libre
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
