import { createClient } from "@/lib/supabase/server";
import { Truck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import PeriodSelector from "./period-selector";

export default async function ShipmentsPage(props: { searchParams: Promise<{ period?: string }> }) {
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

  // Sync shipments dynamically before retrieving them so the page has fresh status info
  try {
    const { syncShipments } = await import("@/services/meli/syncShipments");
    await syncShipments(tenantId);
  } catch (err) {
    console.error("Failed to run on-demand shipment sync on page load:", err);
  }

  // Fetch shipments within date range
  const { data: shipments } = await supabase
    .from("shipments")
    .select("*, orders(meli_order_id, buyer_nickname)")
    .eq("tenant_id", tenantId)
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString())
    .order("date_created", { ascending: false });

  // KPIs
  let pendientes = 0;
  let enCamino = 0;
  let demorados = 0;
  let entregados = 0;

  shipments?.forEach(s => {
    const status = s.status?.toLowerCase();
    const substatus = s.substatus?.toLowerCase();

    if (status === "pending" || status === "handling" || status === "ready_to_ship") {
      pendientes++;
    } else if (status === "shipped") {
      enCamino++;
    } else if (status === "delivered") {
      entregados++;
    }

    if (substatus === "delayed" || substatus?.includes("delayed") || substatus?.includes("late")) {
      demorados++;
    }
  });

  const shipmentMetrics: MetricItem[] = [
    {
      label: "Pendientes",
      value: pendientes.toString(),
      subtext: "Por empaquetar o despachar",
      icon: <Clock className="w-4 h-4" />
    },
    {
      label: "En Camino",
      value: enCamino.toString(),
      subtext: "En tránsito con colecta o correo",
      icon: <Truck className="w-4 h-4" />
    },
    {
      label: "Demorados",
      value: demorados.toString(),
      subtext: "Con alertas de entrega tardía",
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: demorados > 0 ? "warning" : "neutral"
    },
    {
      label: "Entregados",
      value: entregados.toString(),
      subtext: "Completados en destino",
      icon: <CheckCircle2 className="w-4 h-4" />,
      highlight: "positive"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Operación logística"
        title="Envíos y logística"
        description="Control de paquetes en tránsito, entregas demoradas y estados reportados por Mercado Envíos."
        actions={<PeriodSelector currentPeriod={period} />}
      />

      {/* Franja de Indicadores */}
      <MetricStrip metrics={shipmentMetrics} columns={4} />

      {/* Tabla de Envíos */}
      <DataTableShell
        isEmpty={!shipments || shipments.length === 0}
        emptyState={
          <OperationalEmptyState
            icon={Truck}
            title="No hay envíos registrados"
            description="No encontramos operaciones logísticas registradas para este período. Probá cambiando el filtro temporal."
          />
        }
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Orden</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Subestado</th>
              <th className="px-4 py-3 font-semibold">Modalidad</th>
              <th className="px-4 py-3 font-semibold">Tracking</th>
              <th className="px-4 py-3 font-semibold text-right">Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {shipments?.map((s) => {
              const isDelivered = s.status?.toLowerCase() === 'delivered';
              const isShipped = s.status?.toLowerCase() === 'shipped';
              const isDelayed = s.substatus?.toLowerCase() === 'delayed' || s.substatus?.toLowerCase()?.includes('delayed');

              return (
                <tr key={s.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                  <td className="px-4 py-3 text-[#5F6875] whitespace-nowrap">
                    {new Date(s.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#101828] font-mono">
                    #{s.orders?.meli_order_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#101828] font-medium truncate max-w-[150px]" title={s.orders?.buyer_nickname || "—"}>
                    {s.orders?.buyer_nickname || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={isDelivered ? 'success' : isShipped ? 'info' : 'neutral'}>
                      {s.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    {isDelayed ? (
                      <StatusBadge variant="warning">Demorado</StatusBadge>
                    ) : s.substatus ? (
                      <span className="text-[#5F6875] capitalize">{s.substatus}</span>
                    ) : (
                      <span className="text-[#5F6875]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#101828] capitalize">
                    {s.logistic_type?.replace(/_/g, " ") || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#5F6875]">
                    {s.tracking_number || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-right text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${Number(s.shipping_cost || 0).toLocaleString("es-AR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
