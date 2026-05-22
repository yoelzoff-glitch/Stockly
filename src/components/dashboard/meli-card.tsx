"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function MeliCard({ status }: { status: "conectado" | "pendiente" }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sync products first so order items can find them
      const resProducts = await fetch("/api/meli/sync-products", { method: "POST" });
      const dataProducts = await resProducts.json();
      
      if (!resProducts.ok) {
        throw new Error(dataProducts.error || "Error al sincronizar productos");
      }

      // Then sync orders
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Mercado Libre</CardTitle>
        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <CardDescription className="mt-2 mb-4">
          Sincroniza tus publicaciones, stock y ventas de Mercado Libre.
        </CardDescription>
        <div className="flex items-center justify-between">
          <Badge variant={status === 'conectado' ? 'default' : 'secondary'} className="capitalize">
            {status}
          </Badge>
          
          {status === 'conectado' ? (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  "Sincronizar"
                )}
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={async () => {
                  if (confirm("¿Estás seguro de desconectar tu cuenta de Mercado Libre?")) {
                    await fetch("/api/meli/disconnect", { method: "POST" });
                    router.refresh();
                  }
                }}
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <a href="/api/meli/connect">
              <Button variant="outline" size="sm">Conectar</Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
