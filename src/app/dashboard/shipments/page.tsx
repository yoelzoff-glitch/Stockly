import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default async function ShipmentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Fetch shipments
  const { data: shipments } = await supabase
    .from("shipments")
    .select("*, orders(meli_order_id, buyer_nickname)")
    .eq("tenant_id", tenantId)
    .order("date_created", { ascending: false });

  // KPIs
  let pendientes = 0;
  let enCamino = 0;
  let demorados = 0;
  let entregados = 0;

  shipments?.forEach(s => {
    const status = s.status?.toLowerCase();
    const substatus = s.substatus?.toLowerCase();

    if (status === "pending") pendientes++;
    else if (status === "shipped") enCamino++;
    else if (status === "delivered") entregados++;
    
    if (substatus === "delayed") demorados++;
  });

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Envíos</h2>
        <p className="text-muted-foreground mt-1">Controla el estado de tu logística y despachos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Camino</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enCamino}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demorados</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{demorados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entregados}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Envíos</CardTitle>
        </CardHeader>
        <CardContent>
          {shipments && shipments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Subestado</th>
                    <th className="px-4 py-3">Logística</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="px-4 py-3">{new Date(s.date_created).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{s.orders?.meli_order_id || 'N/A'}</td>
                      <td className="px-4 py-3">{s.orders?.buyer_nickname || 'N/A'}</td>
                      <td className="px-4 py-3 capitalize">{s.status}</td>
                      <td className="px-4 py-3 capitalize text-red-500">{s.substatus === 'delayed' ? 'Demorado' : s.substatus}</td>
                      <td className="px-4 py-3">{s.logistic_type}</td>
                      <td className="px-4 py-3">{s.tracking_number}</td>
                      <td className="px-4 py-3">${s.shipping_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">No hay envíos registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
