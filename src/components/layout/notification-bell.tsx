"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bell,
  Check,
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
  ExternalLink
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  tenant_id: string;
  type: string;
  category: "attention" | "activity";
  severity: "info" | "warning" | "danger" | "critical" | "error";
  title: string;
  body?: string;
  action_url?: string;
  action_label?: string;
  status: "open" | "resolved" | "archived";
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [tenantId, setTenantId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) return;
    setTenantId(profile.tenant_id);

    // Fetch up to 30 recent alerts excluding archived daily summaries
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .neq("status", "archived")
      .not("title", "like", "Resumen Diario%")
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      const items = data as NotificationItem[];
      setAlerts(items);

      // Compute unread count only for active relevant notifications
      const activeUnread = items.filter(a => {
        if (a.is_read) return false;
        if (a.status === "archived") return false;
        if (a.category === "attention" && a.status === "resolved") return false;
        return true;
      });
      setUnreadCount(activeUnread.length);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAlerts();

    // Supabase Realtime Subscription on private tenant channel with debounce
    let channel: any;
    let debounceTimer: NodeJS.Timeout | null = null;

    if (tenantId) {
      channel = supabase
        .channel(`tenant-notifications:${tenantId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${tenantId}` },
          () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              fetchAlerts();
            }, 300);
          }
        )
        .subscribe();
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [tenantId, fetchAlerts, isOpen, supabase]);

  const markAsRead = async (id: string) => {
    if (!tenantId) return;
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from("alerts")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
  };

  const markAllAsRead = async () => {
    if (!tenantId) return;
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setUnreadCount(0);

    await supabase
      .from("alerts")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .eq("tenant_id", tenantId);
  };

  // Group alerts into the two canonical sections
  // 1. Attention: open state alerts (sorted by severity danger -> warning -> info, then date)
  const severityRank = (s: string) => {
    if (s === "danger" || s === "critical" || s === "error") return 3;
    if (s === "warning") return 2;
    return 1;
  };

  const attentionAlerts = alerts
    .filter(a => a.category === "attention" && a.status === "open")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 4);

  // 2. Activity: immutable events
  const activityEvents = alerts
    .filter(a => a.category === "activity")
    .slice(0, 4);

  // Determine badge color dynamically
  const unreadAlerts = alerts.filter(a => !a.is_read && a.status === "open");
  const hasCriticalUnread = unreadAlerts.some(a => a.severity === "danger" || a.severity === "critical" || a.severity === "error");
  const hasWarningUnread = unreadAlerts.some(a => a.severity === "warning");

  const badgeColorClass = hasCriticalUnread
    ? "bg-[#D92D20] text-white"
    : hasWarningUnread
    ? "bg-[#F79009] text-white"
    : "bg-[#102A56] text-white";

  const getIcon = (item: NotificationItem) => {
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

  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Recién";
    if (minutes < 60) return `Hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notificaciones y alertas (${unreadCount} no leídas)`}
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[#DCDAD4] bg-white text-[#5F6875] hover:bg-[#F5F3EE] hover:text-[#101828] transition-colors focus:outline-none focus:ring-2 focus:ring-[#102A56]"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold tabular-nums shadow-sm ${badgeColorClass}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Centro de alertas y actividad"
          className="absolute right-0 mt-2 w-96 rounded-lg border border-[#DCDAD4] bg-white shadow-xl z-50 overflow-hidden text-xs text-[#101828]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#DCDAD4] bg-[#FCFCFA]">
            <div>
              <h3 className="font-bold text-xs text-[#101828]">Alertas y Actividad</h3>
              <p className="text-[11px] text-[#5F6875]">Eventos operativos del negocio</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-[#102A56] hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#E2E8F0]">
            {/* Sección 1: Requieren Atención */}
            {attentionAlerts.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-[#FFF9F2] border-b border-[#FEE4E2]/50 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B54708]">
                    Requieren Atención ({attentionAlerts.length})
                  </span>
                </div>
                <div className="divide-y divide-[#F2F4F7]">
                  {attentionAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-3.5 flex gap-3 hover:bg-[#F5F3EE]/50 transition-colors ${
                        !alert.is_read ? "bg-[#FFFBF5]" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{getIcon(alert)}</div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-xs text-[#101828] leading-tight truncate" title={alert.title}>
                            {alert.title}
                          </p>
                          <span className="text-[10px] text-[#5F6875] shrink-0 font-mono">
                            {timeAgo(alert.created_at)}
                          </span>
                        </div>
                        {alert.body && (
                          <p className="text-[11px] text-[#5F6875] leading-relaxed line-clamp-2">
                            {alert.body}
                          </p>
                        )}
                        {alert.action_url && (
                          <div className="pt-1">
                            <button
                              onClick={() => {
                                if (!alert.is_read) markAsRead(alert.id);
                                setIsOpen(false);
                                router.push(alert.action_url!);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#102A56] hover:underline"
                            >
                              <span>{alert.action_label || "Revisar"}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#F79009] shrink-0 mt-1.5" title="No leída" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sección 2: Actividad Reciente */}
            <div>
              <div className="px-4 py-1.5 bg-[#FCFCFA] border-b border-[#DCDAD4] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6875]">
                  Actividad Reciente
                </span>
              </div>
              {activityEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#5F6875]">
                  No hay actividad reciente registrada.
                </div>
              ) : (
                <div className="divide-y divide-[#F2F4F7]">
                  {activityEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => {
                        if (!event.is_read) markAsRead(event.id);
                        if (event.action_url) {
                          setIsOpen(false);
                          router.push(event.action_url);
                        }
                      }}
                      className={`p-3.5 flex gap-3 hover:bg-[#F5F3EE]/50 transition-colors cursor-pointer ${
                        !event.is_read ? "bg-[#F8F9FC]" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{getIcon(event)}</div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-xs text-[#101828] leading-tight truncate" title={event.title}>
                            {event.title}
                          </p>
                          <span className="text-[10px] text-[#5F6875] shrink-0 font-mono">
                            {timeAgo(event.created_at)}
                          </span>
                        </div>
                        {event.body && (
                          <p className="text-[11px] text-[#5F6875] leading-relaxed line-clamp-1">
                            {event.body}
                          </p>
                        )}
                      </div>
                      {!event.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#102A56] shrink-0 mt-1.5" title="No leída" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-[#DCDAD4] bg-[#FCFCFA]">
            <button
              className="w-full text-center text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE] py-2 rounded transition-colors"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
            >
              Ver toda la actividad y alertas →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
