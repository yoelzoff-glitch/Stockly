import { useState, useEffect } from "react";
import { History, Tag, Package, Bot, ShoppingCart, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface HistoryEvent {
  id: string;
  type: "price" | "stock" | "ai" | "sale" | "sync";
  date: string;
  old_value?: number;
  new_value?: number;
  difference?: number;
  source?: string;
  action?: string;
  status?: string;
  risk?: string;
  quantity?: number;
  total?: number;
}

export function ProductHistoryTab({ productId }: { productId: string }) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "price" | "stock" | "ai" | "sale" | "sync">("all");

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}/history`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.timeline || []);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchHistory();
  }, [productId]);

  const filteredEvents = events.filter(e => filter === "all" || e.type === filter);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando historial...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 pb-4 border-b">
        {(["all", "price", "stock", "ai", "sale", "sync"] as const).map(f => (
          <Button 
            key={f} 
            variant={filter === f ? "default" : "outline"} 
            size="sm" 
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f === "all" ? "Todo" : f === "sale" ? "Ventas" : f}
          </Button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
          <History className="w-8 h-8 mb-2 opacity-20" />
          <p>No hay eventos registrados.</p>
        </div>
      ) : (
        <div className="relative border-l ml-3 pl-6 space-y-8 pb-4">
          {filteredEvents.map(event => {
            let icon = <History className="w-4 h-4 text-slate-500" />;
            let bgClass = "bg-slate-100 dark:bg-slate-800";
            let content = null;

            if (event.type === "price") {
              icon = <Tag className="w-4 h-4 text-blue-600" />;
              bgClass = "bg-blue-100 dark:bg-blue-900/30";
              content = (
                <div className="text-sm">
                  <span className="font-medium">Cambio de Precio</span>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <span className="line-through">${event.old_value?.toLocaleString()}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-foreground font-medium">${event.new_value?.toLocaleString()}</span>
                  </div>
                </div>
              );
            } else if (event.type === "stock") {
              icon = <Package className="w-4 h-4 text-emerald-600" />;
              bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
              const isAdd = (event.difference || 0) > 0;
              content = (
                <div className="text-sm">
                  <span className="font-medium">Actualización de Stock</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={isAdd ? "default" : "destructive"} className="text-[10px] h-5">
                      {isAdd ? "+" : ""}{event.difference}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      De {event.old_value} a {event.new_value}
                    </span>
                  </div>
                </div>
              );
            } else if (event.type === "ai") {
              icon = <Bot className="w-4 h-4 text-indigo-600" />;
              bgClass = "bg-indigo-100 dark:bg-indigo-900/30";
              content = (
                <div className="text-sm">
                  <span className="font-medium">Sugerencia IA: {event.action}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{event.status}</Badge>
                    {event.risk === "high" && <AlertTriangle className="w-3 h-3 text-red-500" />}
                  </div>
                </div>
              );
            } else if (event.type === "sale") {
              icon = <ShoppingCart className="w-4 h-4 text-amber-600" />;
              bgClass = "bg-amber-100 dark:bg-amber-900/30";
              content = (
                <div className="text-sm">
                  <span className="font-medium">Venta Registrada</span>
                  <div className="text-muted-foreground mt-1">
                    {event.quantity} unidad(es) por <span className="font-medium text-foreground">${event.total?.toLocaleString()}</span>
                  </div>
                </div>
              );
            } else if (event.type === "sync") {
              icon = <RefreshCw className="w-4 h-4 text-slate-500" />;
              bgClass = "bg-slate-100 dark:bg-slate-800";
              content = (
                <div className="text-sm">
                  <span className="font-medium">Sincronización</span>
                  <p className="text-muted-foreground mt-1 text-xs">Actualizado con Mercado Libre</p>
                </div>
              );
            }

            return (
              <div key={event.id} className="relative">
                <div className={`absolute -left-[35px] flex items-center justify-center w-8 h-8 rounded-full border shadow-sm ${bgClass}`}>
                  {icon}
                </div>
                <div className="flex flex-col">
                  {content}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {event.source && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {event.source}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
