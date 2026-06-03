import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Ban, DollarSign, TrendingDown, Users } from "lucide-react";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";

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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single();
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';

  const todayDate = getMidnightInTimezone(new Date(), timezone);
  
  const firstDayOfMonthRaw = new Date(todayDate);
  firstDayOfMonthRaw.setDate(1);
  const firstDayOfMonth = getMidnightInTimezone(firstDayOfMonthRaw, timezone);

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
        <MetricCard title="Canceladas Hoy" value={hoy} icon={<Ban className="w-5 h-5" />} variant="red" />
        <MetricCard title="Este Mes" value={mes} icon={<Users className="w-5 h-5" />} variant="slate" />
        <MetricCard title="Monto Devuelto" value={`$${montoPerdido.toLocaleString('es-AR')}`} icon={<DollarSign className="w-5 h-5" />} variant="amber" />
        <MetricCard title="Tasa de Cancelación" value={`${rate}%`} icon={<TrendingDown className="w-5 h-5" />} variant="purple" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Cancelaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {cancellations && cancellations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Cancelado Por</th>
                    <th className="px-4 py-3">Devolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cancellations.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">{new Date(c.date_cancelled).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{c.orders?.meli_order_id || 'N/A'}</td>
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <Ban className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No hay cancelaciones registradas</h3>
              <p className="text-sm text-slate-500 mt-1">Aún no se ha detectado ninguna cancelación de orden.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
