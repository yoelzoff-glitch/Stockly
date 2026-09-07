"use client";

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Check,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  PackageX,
  ShoppingBag,
  XCircle,
  DollarSign,
  TrendingDown,
  Unlink,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Bell
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationAlert {
  id: string;
  tenant_id: string;
  type: string;
  category: "attention" | "activity";
  severity: "info" | "warning" | "danger" | "critical" | "error";
  source: string;
  title: string;
  body?: string;
  action_url?: string;
  action_label?: string;
  entity_type?: string;
  entity_id?: string;
  dedupe_key?: string;
  status: "open" | "resolved" | "archived";
  is_read: boolean;
  read_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
}

export default function NotificationsClientPage({
  initialAlerts,
  tenantId
}: {
  initialAlerts: any[];
  tenantId: string;
}) {
  const [alerts, setAlerts] = useState<NotificationAlert[]>(initialAlerts);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "attention" | "activity" | "unread" | "resolved">("all");
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();
  const router = useRouter();

  // Mark single alert as read (does NOT resolve operational status)
  const markAsRead = async (id: string) => {
    setAlerts(prev =>
      prev.map(a => (a.id === id ? { ...a, is_read: true, read_at: new Date().toISOString() } : a))
    );

    await supabase
      .from("alerts")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    startTransition(() => {
      router.refresh();
    });
  };

  // Mark all active alerts as read
  const markAllAsRead = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    const readTimestamp = new Date().toISOString();
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true, read_at: readTimestamp })));

    await supabase
      .from("alerts")
      .update({ is_read: true, read_at: readTimestamp })
      .in("id", unreadIds)
      .eq("tenant_id", tenantId);

    startTransition(() => {
      router.refresh();
    });
  };

  // Metric strip calculations
  const attentionOpenCount = alerts.filter(a => a.category === "attention" && a.status === "open").length;
  const activityCount = alerts.filter(a => a.category === "activity" && a.status !== "archived").length;
  const unreadCount = alerts.filter(a => !a.is_read && a.status !== "archived").length;
  const resolvedCount = alerts.filter(a => a.status === "resolved").length;

  const metricItems: MetricItem[] = [
    {
      label: "Requieren Atención",
      value: attentionOpenCount.toString(),
      subtext: "Alertas abiertas con acción requerida",
      highlight: attentionOpenCount > 0 ? "critical" : "neutral"
    },
    {
      label: "Actividad Registrada",
      value: activityCount.toString(),
      subtext: "Ventas, cancelaciones y eventos"
    },
    {
      label: "No Leídas",
      value: unreadCount.toString(),
      subtext: "Notificaciones pendientes de revisión",
      highlight: unreadCount > 0 ? "warning" : "neutral"
    },
    {
      label: "Resueltas",
      value: resolvedCount.toString(),
      subtext: "Alertas operativas subsanadas"
    }
  ];

  // Filtering list based on selected filter tab and search term
  const filteredAlerts = alerts.filter(alert => {
    // Filter tab
    if (activeFilter === "attention") {
      if (!(alert.category === "attention" && alert.status === "open")) return false;
    } else if (activeFilter === "activity") {
      if (alert.category !== "activity" || alert.status === "archived") return false;
    } else if (activeFilter === "unread") {
      if (alert.is_read || alert.status === "archived") return false;
    } else if (activeFilter === "resolved") {
      if (alert.status !== "resolved") return false;
    } else {
      // "all": show open attention, all activity, and resolved; exclude archived
      if (alert.status === "archived") return false;
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = alert.title?.toLowerCase().includes(term);
      const matchBody = alert.body?.toLowerCase().includes(term);
      const matchType = alert.type?.toLowerCase().includes(term);
      return matchTitle || matchBody || matchType;
    }

    return true;
  });

  const getIcon = (item: NotificationAlert) => {
    switch (item.type) {
      case "sale_created":
        return <ShoppingBag className="w-4 h-4 text-[#039855]" />;
      case "sale_cancelled":
        return <XCircle className="w-4 h-4 text-[#D92D20]" />;
      case "missing_costs":
        return <DollarSign className="w-4 h-4 text-[#B54708]" />;
      case "critical_stock":
        return <PackageX className="w-4 h-4 text-[#D92D20]" />;
      case "negative_margin":
        return <TrendingDown className="w-4 h-4 text-[#D92D20]" />;
      case "integration_disconnected":
        return <Unlink className="w-4 h-4 text-[#D92D20]" />;
      case "sync_failed":
        return <RefreshCw className="w-4 h-4 text-[#B54708]" />;
      default:
        if (item.severity === "danger" || item.severity === "critical" || item.severity === "error") {
          return <AlertCircle className="w-4 h-4 text-[#D92D20]" />;
        }
        if (item.severity === "warning") {
          return <AlertTriangle className="w-4 h-4 text-[#B54708]" />;
        }
        return <Info className="w-4 h-4 text-[#102A56]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <OperationalPageHeader
        eyebrow="Centro de control"
        title="Actividad y alertas"
        description="Centro unificado de alertas operativas que exigen acción y registro cronológico de actividad relevante de tu negocio."
        actions={
          unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-[#5F6875]" />
              Marcar todas como leídas
            </Button>
          )
        }
      />

      {/* Metric Strip */}
      <MetricStrip metrics={metricItems} columns={4} />

      {/* Toolbar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeFilter === "all"
                ? "bg-[#102A56] text-white shadow-sm"
                : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            Todas ({alerts.filter(a => a.status !== "archived").length})
          </button>
          <button
            onClick={() => setActiveFilter("attention")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeFilter === "attention"
                ? "bg-[#102A56] text-white shadow-sm"
                : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            Requieren atención ({attentionOpenCount})
          </button>
          <button
            onClick={() => setActiveFilter("activity")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeFilter === "activity"
                ? "bg-[#102A56] text-white shadow-sm"
                : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            Actividad ({activityCount})
          </button>
          <button
            onClick={() => setActiveFilter("unread")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeFilter === "unread"
                ? "bg-[#102A56] text-white shadow-sm"
                : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            No leídas ({unreadCount})
          </button>
          <button
            onClick={() => setActiveFilter("resolved")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeFilter === "resolved"
                ? "bg-[#102A56] text-white shadow-sm"
                : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            Resueltas ({resolvedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#5F6875]" />
          <Input
            type="text"
            placeholder="Buscar en alertas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs border-[#DCDAD4] bg-white text-[#101828] focus-visible:ring-[#102A56]"
          />
        </div>
      </div>

      {/* Notifications List */}
      {filteredAlerts.length === 0 ? (
        <OperationalEmptyState
          icon={Bell}
          title={
            activeFilter === "attention"
              ? "No hay alertas que requieran atención"
              : activeFilter === "unread"
              ? "Estás al día"
              : "No se encontraron notificaciones"
          }
          description={
            activeFilter === "attention"
              ? "Excelente. No existen discrepancias de costos, stock crítico ni desconexiones pendientes."
              : activeFilter === "unread"
              ? "No tienes notificaciones pendientes de lectura en este momento."
              : "No hay registros que coincidan con los filtros o el término de búsqueda ingresado."
          }
        />
      ) : (
        <div className="divide-y divide-[#E2E8F0] border border-[#DCDAD4] rounded-lg bg-white overflow-hidden shadow-sm">
          {filteredAlerts.map(alert => {
            const isResolved = alert.status === "resolved";
            const isCritical = alert.severity === "danger" || alert.severity === "critical" || alert.severity === "error";
            const isWarning = alert.severity === "warning";

            return (
              <div
                key={alert.id}
                className={`p-4 flex items-start gap-3.5 transition-colors hover:bg-[#F5F3EE]/40 ${
                  isResolved
                    ? "bg-[#FCFCFA]/80 opacity-75"
                    : !alert.is_read
                    ? "bg-[#FFFBF5]"
                    : "bg-white"
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">{getIcon(alert)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`text-xs ${
                          !alert.is_read ? "font-bold text-[#101828]" : "font-semibold text-[#101828]"
                        }`}
                      >
                        {alert.title}
                      </h4>

                      {/* Status / Category Badges */}
                      {isResolved ? (
                        <StatusBadge variant="neutral">RESUELTA</StatusBadge>
                      ) : alert.category === "attention" ? (
                        <StatusBadge variant={isCritical ? "danger" : isWarning ? "warning" : "neutral"}>
                          {isCritical ? "CRÍTICO" : isWarning ? "ATENCIÓN" : "INFO"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="success">ACTIVIDAD</StatusBadge>
                      )}

                      {!alert.is_read && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#102A56] text-white">
                          NUEVA
                        </span>
                      )}
                    </div>

                    <span suppressHydrationWarning className="text-[11px] font-mono text-[#5F6875] shrink-0">
                      {new Date(alert.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  {alert.body && (
                    <p className="text-xs text-[#5F6875] leading-relaxed max-w-3xl">
                      {alert.body}
                    </p>
                  )}

                  {isResolved && alert.resolved_at && (
                    <p className="text-[11px] text-[#039855] font-medium pt-0.5">
                      ✓ Condición resuelta automáticamente el{" "}
                      {new Date(alert.resolved_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {alert.action_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!alert.is_read) markAsRead(alert.id);
                        router.push(alert.action_url!);
                      }}
                      className="h-7 px-2.5 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828]"
                    >
                      <span>{alert.action_label || "Ver detalle"}</span>
                      <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  )}

                  {!alert.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(alert.id)}
                      className="h-7 px-2 text-xs text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
                      title="Marcar como leída"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
