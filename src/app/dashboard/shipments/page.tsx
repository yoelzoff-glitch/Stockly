import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
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
        <MetricCard title="Pendientes" value={pendientes} icon={<Clock className="w-5 h-5" />} variant="slate" />
        <MetricCard title="En Camino" value={enCamino} icon={<Truck className="w-5 h-5" />} variant="blue" />
        <MetricCard title="Demorados" value={demorados} icon={<AlertCircle className="w-5 h-5" />} variant="red" />
        <MetricCard title="Entregados" value={entregados} icon={<CheckCircle2 className="w-5 h-5" />} variant="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Envíos</CardTitle>
        </CardHeader>
        <CardContent>
          {shipments && shipments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {shipments.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">{new Date(s.date_created).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{s.orders?.meli_order_id || 'N/A'}</td>
                      <td className="px-4 py-3">{s.orders?.buyer_nickname || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={s.status === 'delivered' ? 'success' : s.status === 'shipped' ? 'info' : 'neutral'}>
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {s.substatus ? (
                          <StatusBadge variant={s.substatus === 'delayed' ? 'danger' : 'neutral'}>
                            {s.substatus === 'delayed' ? 'Demorado' : s.substatus}
                          </StatusBadge>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">{s.logistic_type}</td>
                      <td className="px-4 py-3">{s.tracking_number}</td>
                      <td className="px-4 py-3">${s.shipping_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <Truck className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No hay envíos registrados</h3>
              <p className="text-sm text-slate-500 mt-1">Aún no procesamos información de logística.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
