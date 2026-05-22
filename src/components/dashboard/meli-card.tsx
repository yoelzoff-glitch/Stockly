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
      const res = await fetch("/api/meli/sync-products", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        alert(`¡Sincronización exitosa! Se procesaron ${data.syncedCount} publicaciones.`);
        router.refresh();
      } else {
        alert(`Error al sincronizar: ${data.error}`);
      }
    } catch (error) {
      alert("Error de red al intentar sincronizar.");
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
            </div>
          ) : (
            <Link href="/api/meli/connect">
              <Button variant="outline" size="sm">Conectar</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
