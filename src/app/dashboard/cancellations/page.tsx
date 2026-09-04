import { createClient } from "@/lib/supabase/server";
import { Ban, DollarSign, TrendingDown, Users } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
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
  const tenantDateStr = tenantDateFormatter.format(new Date());
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  let dateFrom: Date;
  let dateTo = new Date();

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
  } else {
    dateFrom = new Date(2000, 0, 1);
  }

  // Fetch cancellations in date range
  const { data: rawCancellations } = await supabase
    .from("order_cancellations")
    .select("*, orders(meli_order_id, buyer_nickname, date_created, raw_data)")
    .eq("tenant_id", tenantId)
    .gte("date_cancelled", dateFrom.toISOString())
    .lte("date_cancelled", dateTo.toISOString())
    .order("date_cancelled", { ascending: false });

  const cancellations = (rawCancellations || []).filter(c => {
    const order = c.orders as any;
    if (!order) return false;
    const payments = order.raw_data?.payments || [];
    return payments.some((p: any) => p.status === 'approved' || p.status === 'refunded');
  });

  // Fetch orders in date range to calculate rates
  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, date_created")
    .eq("tenant_id", tenantId)
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  const totalOrders = allOrders?.length || 1;
  const totalCancellations = cancellations.length;
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

  const rateNum = Number(rate);

  const cancellationMetrics: MetricItem[] = [
    {
      label: "Canceladas Hoy",
      value: hoy.toString(),
      subtext: "Registradas desde 00:00 hs",
      icon: <Ban className="w-4 h-4" />,
      highlight: hoy > 0 ? "critical" : "neutral"
    },
    {
      label: `Total (${periodLabel})`,
      value: totalCancellations.toString(),
      subtext: `De ${totalOrders} órdenes totales`,
      icon: <Users className="w-4 h-4" />
    },
    {
      label: "Monto Devuelto",
      value: `$${montoPerdido.toLocaleString('es-AR')}`,
      subtext: "Reembolsado a compradores",
      icon: <DollarSign className="w-4 h-4" />,
      highlight: montoPerdido > 0 ? "critical" : "neutral"
    },
    {
      label: "Tasa de Cancelación",
      value: `${rate}%`,
      subtext: "Sobre el total de ventas",
      icon: <TrendingDown className="w-4 h-4" />,
      highlight: rateNum > 5 ? "critical" : rateNum > 2 ? "warning" : "neutral"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Operación comercial"
        title="Cancelaciones y devoluciones"
        description="Seguimiento de pedidos anulados, impacto económico de los reembolsos y motivos reportados."
        actions={<PeriodSelector currentPeriod={period} />}
      />

      {/* Franja de Indicadores */}
      <MetricStrip metrics={cancellationMetrics} columns={4} />

      {/* Tabla de Cancelaciones */}
      <DataTableShell
        isEmpty={!cancellations || cancellations.length === 0}
        emptyState={
          <OperationalEmptyState
            icon={Ban}
            title="Sin cancelaciones registradas"
            description="Excelente: no se registraron órdenes canceladas ni reembolsos en el período seleccionado."
          />
        }
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Nº Orden</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Motivo</th>
              <th className="px-4 py-3 font-semibold">Cancelado Por</th>
              <th className="px-4 py-3 font-semibold text-right">Devolución</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cancellations.map((c) => (
              <tr key={c.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                <td className="px-4 py-3 text-[#5F6875] whitespace-nowrap">
                  {new Date(c.date_cancelled).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </td>
                <td className="px-4 py-3 font-semibold text-[#101828] font-mono">
                  #{c.orders?.meli_order_id || '—'}
                </td>
                <td className="px-4 py-3 text-[#101828] font-medium truncate max-w-[150px]" title={c.orders?.buyer_nickname || "—"}>
                  {c.orders?.buyer_nickname || '—'}
                </td>
                <td className="px-4 py-3 text-[#101828] truncate max-w-[220px]" title={c.reason || "Sin especificar"}>
                  {c.reason || "Sin especificar"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge variant={c.cancelled_by?.toLowerCase() === 'seller' ? 'warning' : 'neutral'}>
                    {c.cancelled_by || 'Comprador'}
                  </StatusBadge>
                </td>
                <td
                  className="px-4 py-3 font-bold text-right text-[#D92D20] tabular-nums"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  ${Number(c.refund_amount || 0).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
