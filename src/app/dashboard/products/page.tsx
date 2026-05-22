import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/integrations">
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
          <CardDescription>
            Tus productos sincronizados desde Mercado Libre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!products || products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Todavía no sincronizaste productos</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Conecta tu cuenta de Mercado Libre y sincroniza tu catálogo para verlo aquí.
              </p>
              <Link href="/dashboard/integrations">
                <Button variant="outline">Ir a Integraciones</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="border-b bg-muted/50 font-medium">
                  <tr>
                    <th className="h-10 px-4 align-middle">Producto</th>
                    <th className="h-10 px-4 align-middle text-right">Precio</th>
                    <th className="h-10 px-4 align-middle text-right">Stock</th>
                    <th className="h-10 px-4 align-middle text-right">Vendidos</th>
                    <th className="h-10 px-4 align-middle">Estado</th>
                    <th className="h-10 px-4 align-middle text-right">Última Sinc.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle font-medium">
                        <div className="flex items-center gap-3">
                          {product.thumbnail_url && (
                            <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                          )}
                          <span className="line-clamp-2">{product.title}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-right">
                        ${product.price?.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {product.available_quantity}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {product.sold_quantity}
                      </td>
                      <td className="p-4 align-middle">
                        <Badge variant={product.status === "active" ? "default" : "secondary"}>
                          {product.status}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-right text-muted-foreground">
                        {new Date(product.last_synced_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
