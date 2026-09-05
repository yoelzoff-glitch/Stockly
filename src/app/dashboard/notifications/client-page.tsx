"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { createClient } from "@/lib/supabase/client";
import { Search, Check, Trash2, AlertTriangle, Info, AlertCircle, PackageX, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationsClientPage({ initialAlerts, tenantId }: { initialAlerts: any[], tenantId: string }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("action_required");
  const supabase = createClient();
  const router = useRouter();

  const markAsRead = async (id: string) => {
    const original = [...alerts];
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));

    const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", id).eq("tenant_id", tenantId);
    if (error) {
      setAlerts(original);
      console.error(error);
    } else {
      router.refresh();
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    setAlerts(alerts.map(a => ({ ...a, is_read: true })));
    await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds).eq("tenant_id", tenantId);
    router.refresh();
  };

  const deleteAlert = async (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
    await supabase.from("alerts").delete().eq("id", id).eq("tenant_id", tenantId);
  };

  // Grouping logic:
  // 1. Requieren acción: unread and severity critical, error, or warning
  // 2. Informativas: unread and severity info/other
  // 3. Resueltas: is_read === true
  const actionRequiredAlerts = alerts.filter(a => !a.is_read && (a.severity === "critical" || a.severity === "error" || a.severity === "warning"));
  const informativeAlerts = alerts.filter(a => !a.is_read && a.severity !== "critical" && a.severity !== "error" && a.severity !== "warning");
  const resolvedAlerts = alerts.filter(a => a.is_read);

  const metricItems: MetricItem[] = [
    {
      label: "Requieren Acción",
      value: actionRequiredAlerts.length.toString(),
      subtext: "Alertas críticas y advertencias pendientes"
    },
    {
      label: "Informativas",
      value: informativeAlerts.length.toString(),
      subtext: "Eventos de sincronización y estado"
    },
    {
      label: "Resueltas / Leídas",
      value: resolvedAlerts.length.toString(),
      subtext: "Historial de alertas atendidas"
    }
  ];

  const getFilteredList = (list: any[]) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(a =>
      (a.title && a.title.toLowerCase().includes(term)) ||
      (a.body && a.body.toLowerCase().includes(term))
    );
  };

  const renderAlertList = (list: any[], emptyTitle: string, emptyDesc: string) => {
    const filtered = getFilteredList(list);

    if (filtered.length === 0) {
      return (
        <OperationalEmptyState
          title={emptyTitle}
          description={emptyDesc}
        />
      );
    }

    return (
      <div className="divide-y divide-[#DCDAD4] border border-[#DCDAD4] rounded-lg bg-[#FFFFFF] overflow-hidden">
        {filtered.map(alert => {
          const isCritical = alert.severity === "critical" || alert.severity === "error";
          const isWarning = alert.severity === "warning";

          return (
            <div
              key={alert.id}
              className={`p-4 flex items-start gap-3.5 hover:bg-[#F5F3EE]/50 transition-colors ${
                !alert.is_read ? "bg-[#FFFFFF]" : "bg-[#FCFCFA] opacity-80"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCritical ? (
                  <AlertCircle className="w-4 h-4 text-[#D92D20]" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-[#B54708]" />
                ) : (
                  <Info className="w-4 h-4 text-[#5F6875]" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`text-xs ${!alert.is_read ? 'font-semibold text-[#101828]' : 'font-medium text-[#5F6875]'}`}>
                      {alert.title}
                    </h4>
                    <StatusBadge variant={isCritical ? "danger" : isWarning ? "warning" : "neutral"}>
                      {alert.severity ? alert.severity.toUpperCase() : "INFO"}
                    </StatusBadge>
                    {!alert.is_read && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#102A56] text-white">
                        NUEVA
                      </span>
                    )}
                  </div>
                  <span suppressHydrationWarning className="text-[11px] font-mono text-[#5F6875] shrink-0">
                    {new Date(alert.created_at).toLocaleString("es-AR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>

                {alert.body && (
                  <p className="text-xs text-[#5F6875] leading-relaxed max-w-3xl">
                    {alert.body}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {!alert.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsRead(alert.id)}
                    className="h-7 text-xs text-[#102A56] hover:bg-[#F5F3EE] px-2 font-medium"
                  >
                    Resolver
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAlert(alert.id)}
                  className="h-7 w-7 p-0 text-[#5F6875] hover:text-[#D92D20] hover:bg-[#D92D20]/10"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Centro de Notificaciones y Alertas"
        description="Supervisión de eventos operativos, discrepancias de inventario y novedades de sincronización."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Marcar todo como leído
            </Button>
          </div>
        }
      />

      <MetricStrip metrics={metricItems} columns={3} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-[#FFFFFF] border border-[#DCDAD4] p-1 rounded-lg">
            <TabsTrigger value="action_required" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
              Requieren Acción ({actionRequiredAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="informative" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
              Informativas ({informativeAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
              Resueltas ({resolvedAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
              Todas ({alerts.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6875]" />
            <Input
              placeholder="Buscar alertas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-3 w-full sm:w-64 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
            />
          </div>
        </div>

        <TabsContent value="action_required" className="outline-none space-y-4">
          {renderAlertList(
            actionRequiredAlerts,
            "Sin alertas pendientes de acción",
            "No hay eventos críticos ni advertencias operativas que requieran tu intervención."
          )}
        </TabsContent>

        <TabsContent value="informative" className="outline-none space-y-4">
          {renderAlertList(
            informativeAlerts,
            "Sin notificaciones informativas pendientes",
            "Todos los avisos de sincronización y estado se encuentran al día."
          )}
        </TabsContent>

        <TabsContent value="resolved" className="outline-none space-y-4">
          {renderAlertList(
            resolvedAlerts,
            "No hay alertas resueltas",
            "Las notificaciones marcadas como leídas o resueltas se archivarán aquí."
          )}
        </TabsContent>

        <TabsContent value="all" className="outline-none space-y-4">
          {renderAlertList(
            alerts,
            "No hay notificaciones registradas",
            "No se encontraron notificaciones en el período reciente."
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
