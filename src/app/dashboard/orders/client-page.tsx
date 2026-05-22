"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface Order {
  id: string;
  meli_order_id: string;
  status: string;
  buyer_nickname: string;
  total_amount: number;
  currency_id: string;
  date_created: string;
  raw_data?: any;
}

interface OrdersClientProps {
  initialOrders: Order[];
}

export function OrdersClient({ initialOrders }: OrdersClientProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = initialOrders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.buyer_nickname?.toLowerCase().includes(term) ||
      o.meli_order_id?.toLowerCase().includes(term)
    );
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "cancelled":
        return "destructive";
      case "shipped":
        return "secondary";
      default:
        return "outline";
    }
  };

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      paid: "Pagado",
      cancelled: "Cancelado",
      shipped: "Enviado",
      payment_required: "Pendiente",
      invalid: "Inválido"
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por comprador o ID..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-4 font-medium">ID Orden (ML)</th>
                <th className="p-4 font-medium">Comprador</th>
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium text-right">Total</th>
                <th className="p-4 font-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No se encontraron órdenes.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-4 font-mono text-xs">{o.meli_order_id}</td>
                    <td className="p-4 font-medium">{o.buyer_nickname}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(new Date(o.date_created))}
                    </td>
                    <td className="p-4 font-medium text-right">
                      {new Intl.NumberFormat("es-AR", {
                        style: "currency",
                        currency: o.currency_id || "ARS",
                      }).format(o.total_amount || 0)}
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant={getStatusBadgeVariant(o.status)}>
                        {translateStatus(o.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
