"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Trash2, AlertTriangle, Info, AlertCircle, PackageX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    
    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setAlerts(data);
      setUnreadCount(data.filter(a => !a.is_read).length);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    fetchAlerts();
  };

  const markAllAsRead = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds);
    fetchAlerts();
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "critical": return <PackageX className="w-4 h-4 text-red-600" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Hace un momento";
    if (hours < 24) return `Hace ${hours} hs`;
    return `Hace ${Math.floor(hours / 24)} d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border bg-background shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-indigo-600 hover:underline flex items-center">
                <Check className="w-3 h-3 mr-1" /> Marcar todas
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No tienes notificaciones.
              </div>
            ) : (
              <div className="divide-y">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 flex gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${!alert.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                    onClick={() => {
                      if (!alert.is_read) markAsRead(alert.id);
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getIcon(alert.severity)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-sm ${!alert.is_read ? 'font-medium' : 'text-muted-foreground'}`}>
                        {alert.title}
                      </p>
                      {alert.body && <p className="text-xs text-muted-foreground line-clamp-2">{alert.body}</p>}
                      <p className="text-[10px] text-muted-foreground font-mono">{timeAgo(alert.created_at)}</p>
                    </div>
                    {!alert.is_read && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t bg-muted/30">
            <button 
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground py-2 transition-colors"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/notifications");
              }}
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
