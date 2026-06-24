import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Ban, DollarSign, TrendingDown, Users } from "lucide-react";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import PeriodSelector from "./period-selector";

export default async function CancellationsPage(props: { searchParams: Promise<{ period?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) return null;

  const period = searchParams.period || "current_month";

  // Fetch Tenant details first (needed for timezone)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';

  // Get current date parts in tenant's timezone (prevents UTC rollover issues)
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  let dateFrom: Date;
  let dateTo = new Date(); // now

  if (period === "current_month") {
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  } else if (period === "last_month") {
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 2, 1, 12, 0, 0)), timezone);
    const startOfCurrentMonth = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
    dateTo = new Date(startOfCurrentMonth.getTime() - 1);
  } else if (period === "last_30") {
    const tempDate = new Date(tenantYear, tenantMonth - 1, tenantDay, 12, 0, 0);
    tempDate.setDate(tempDate.getDate() - 30);
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 12, 0, 0)), timezone);
  } else { // "all"
    dateFrom = new Date(2000, 0, 1);
  }

  // Fetch cancellations in date range
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("*, orders(meli_order_id, buyer_nickname, date_created)")
    .eq("tenant_id", tenantId)
    .gte("date_cancelled", dateFrom.toISOString())
    .lte("date_cancelled", dateTo.toISOString())
    .order("date_cancelled", { ascending: false });

  // Fetch orders in date range to calculate rates
  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, date_created")
    .eq("tenant_id", tenantId)
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  const totalOrders = allOrders?.length || 1; // avoid division by zero
  const totalCancellations = cancellations?.length || 0;
  const rate = ((totalCancellations / totalOrders) * 100).toFixed(1);

  // KPIs
  let hoy = 0;
  let montoPerdido = 0;

  const todayDate = getMidnightInTimezone(new Date(), timezone);

  cancellations?.forEach(c => {
    const d = new Date(c.date_cancelled);
    if (d >= todayDate) hoy++;
    montoPerdido += Number(c.refund_amount) || 0;
  });

  const periodLabel = period === "current_month" 
    ? "Este Mes" 
    : period === "last_month" 
    ? "Mes Anterior" 
    : period === "last_30" 
    ? "Últimos 30 días" 
    : "Total Período";

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ventas Canceladas</h2>
          <p className="text-muted-foreground mt-1">Analiza los motivos y el impacto de las cancelaciones.</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector currentPeriod={period} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Canceladas Hoy" value={hoy} icon={<Ban className="w-5 h-5" />} variant="red" />
        <MetricCard title={periodLabel} value={totalCancellations} icon={<Users className="w-5 h-5" />} variant="slate" />
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
              <p className="text-sm text-slate-500 mt-1">Aún no se ha detectado ninguna cancelación de orden para este período.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
