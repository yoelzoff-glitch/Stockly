import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban, DollarSign, TrendingDown, Users } from "lucide-react";

export default async function CancellationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Fetch cancellations
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("*, orders(meli_order_id, buyer_nickname)")
    .eq("tenant_id", tenantId)
    .order("date_cancelled", { ascending: false });

  // Fetch all orders to calculate rates
  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, date_created")
    .eq("tenant_id", tenantId);

  const totalOrders = allOrders?.length || 1; // avoid division by zero
  const totalCancellations = cancellations?.length || 0;
  const rate = ((totalCancellations / totalOrders) * 100).toFixed(1);

  // KPIs
  let hoy = 0;
  let mes = 0;
  let montoPerdido = 0;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

  cancellations?.forEach(c => {
    const d = new Date(c.date_cancelled);
    if (d >= todayDate) hoy++;
    if (d >= firstDayOfMonth) mes++;
    montoPerdido += Number(c.refund_amount) || 0;
  });

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ventas Canceladas</h2>
        <p className="text-muted-foreground mt-1">Analiza los motivos y el impacto de las cancelaciones.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas Hoy</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{hoy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Devuelto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${montoPerdido.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Cancelación</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rate}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Cancelaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {cancellations && cancellations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Cancelado Por</th>
                    <th className="px-4 py-3">Devolución</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellations.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="px-4 py-3">{new Date(c.date_cancelled).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{c.orders?.meli_order_id || 'N/A'}</td>
                      <td className="px-4 py-3">{c.orders?.buyer_nickname || 'N/A'}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]" title={c.reason}>{c.reason}</td>
                      <td className="px-4 py-3 capitalize">{c.cancelled_by}</td>
                      <td className="px-4 py-3 font-medium text-red-600">${c.refund_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">No hay cancelaciones registradas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
