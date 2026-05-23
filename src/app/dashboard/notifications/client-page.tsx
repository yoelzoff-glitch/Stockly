"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Search, Check, Trash2, AlertTriangle, Info, AlertCircle, PackageX, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationsClientPage({ initialAlerts }: { initialAlerts: any[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const supabase = createClient();
  const router = useRouter();

  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = a.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.body?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === "unread") return !a.is_read;
    if (filter === "critical") return a.severity === "critical" || a.severity === "error";
    if (filter === "warning") return a.severity === "warning";
    
    return true;
  });

  const getIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "critical": return <PackageX className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const markAsRead = async (id: string) => {
    const original = [...alerts];
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
    
    const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    if (error) {
      setAlerts(original);
      console.error(error);
    } else {
      router.refresh(); // to trigger layout bell update if necessary, though it works client-side too
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    setAlerts(alerts.map(a => ({ ...a, is_read: true })));
    await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds);
    router.refresh();
  };

  const deleteAlert = async (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
    await supabase.from("alerts").delete().eq("id", id);
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Historial de Alertas</CardTitle>
            <CardDescription>Gestiona tus notificaciones y revisa advertencias previas.</CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar notificación..."
                className="pl-9 w-full sm:w-64 bg-muted/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="flex h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="unread">No leídas</option>
              <option value="critical">Críticas</option>
              <option value="warning">Advertencias</option>
            </select>
            <button 
              onClick={markAllAsRead}
              className="h-9 px-3 text-sm font-medium border rounded-md hover:bg-muted/50 transition-colors flex items-center"
            >
              <Check className="w-4 h-4 mr-2" /> Marcar Leídas
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {filteredAlerts.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center text-slate-500">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <Info className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No hay notificaciones</h3>
              <p className="text-sm mt-1">No se encontraron notificaciones que coincidan con los filtros.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-4 flex gap-4 hover:bg-slate-50 transition-colors ${!alert.is_read ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}
              >
                <div className="mt-1 shrink-0">
                  {getIcon(alert.severity)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className={`text-base ${!alert.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {alert.title}
                    </h4>
                    <span className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(alert.created_at).toLocaleString("es-AR", { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  
                  {alert.body && (
                    <p className="text-sm text-muted-foreground max-w-3xl">
                      {alert.body}
                    </p>
                  )}
                  
                  <div className="pt-2 flex gap-3">
                    <StatusBadge variant={alert.severity === 'critical' || alert.severity === 'error' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'}>
                      {alert.severity.toUpperCase()}
                    </StatusBadge>
                    {!alert.is_read && (
                      <StatusBadge variant="info">
                        NUEVA
                      </StatusBadge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-start gap-2 shrink-0">
                  {!alert.is_read && (
                    <button 
                      onClick={() => markAsRead(alert.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Marcar leída
                    </button>
                  )}
                  <button 
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 rounded-md transition-colors mt-auto"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
