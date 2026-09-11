import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserMinus, ExternalLink, Calendar } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminCancellationsPage() {
  const adminDb = createAdminClient();

  const [
    { data: cancelledSubs },
    { data: tenants },
    { data: plans },
    { data: transactions },
  ] = await Promise.all([
    adminDb
      .from("subscriptions")
      .select("*")
      .or("status.eq.cancelled,cancel_at_period_end.eq.true")
      .order("cancelled_at", { ascending: false }),
    adminDb.from("tenants").select("id, name, created_at"),
    adminDb.from("plans").select("id, code, name"),
    adminDb
      .from("billing_transactions")
      .select("tenant_id, amount")
      .eq("status", "approved")
      .eq("type", "payment"),
  ]);

  const tenantMap = new Map((tenants || []).map((t) => [t.id, t]));
  const planMap = new Map((plans || []).map((p) => [p.code, p.name]));
  const planById = new Map((plans || []).map((p) => [p.id, p.name]));

  // Revenue per tenant
  const revMap = new Map<string, number>();
  if (transactions) {
    for (const tx of transactions) {
      revMap.set(tx.tenant_id, (revMap.get(tx.tenant_id) || 0) + Number(tx.amount || 0));
    }
  }

  const list = (cancelledSubs || []).map((sub) => {
    const t = tenantMap.get(sub.tenant_id);
    const planName =
      (sub.plan_id && planById.get(sub.plan_id)) ||
      planMap.get(sub.plan) ||
      sub.plan?.toUpperCase() ||
      "—";

    const createdAt = sub.started_at || t?.created_at || sub.created_at;
    const cancelDate = sub.cancelled_at || sub.updated_at;

    let tenureDays = 0;
    if (createdAt && cancelDate) {
      tenureDays = Math.max(
        Math.floor(
          (new Date(cancelDate).getTime() - new Date(createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        0
      );
    }

    return {
      id: sub.id,
      tenantId: sub.tenant_id,
      tenantName: t?.name || "Desconocido",
      planName,
      createdAt,
      cancelledAt: sub.cancelled_at,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      effectiveDate: sub.current_period_end,
      tenureDays,
      historicalRevenue: revMap.get(sub.tenant_id) || 0,
      reason: sub.cancellation_reason || "other",
      comment: sub.cancellation_comment,
    };
  });

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "too_expensive":
        return "Demasiado caro";
      case "missing_feature":
        return "Falta funcionalidad";
      case "not_using":
        return "No lo usa";
      case "technical_problems":
        return "Problemas técnicos";
      case "switched_product":
        return "Cambió de producto";
      case "business_closed":
        return "Cierre de negocio";
      case "other":
      default:
        return "Otro motivo";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Cancelaciones & Churn
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Registro de bajas efectivas y cancelaciones programadas con motivos y comentarios.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#334155]">
          <UserMinus className="w-4 h-4 text-[#EF4444]" />
          <span>{list.length} registros de cancelación</span>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] uppercase font-bold text-[#64748B] bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Fecha Alta</th>
                <th className="px-4 py-3">Fecha Cancelación</th>
                <th className="px-4 py-3 text-center">Tiempo como Cliente</th>
                <th className="px-4 py-3 text-right">Revenue Histórico</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Comentario</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748B]">
                    No hay cancelaciones registradas. ¡Retención al 100%!
                  </td>
                </tr>
              ) : (
                list.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#0F172A]">
                      {c.tenantName}
                    </td>
                    <td className="px-4 py-3 font-semibold uppercase text-[#334155]">
                      {c.planName}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {new Date(c.createdAt).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {c.cancelledAt
                        ? new Date(c.cancelledAt).toLocaleDateString("es-AR")
                        : c.cancelAtPeriodEnd
                        ? `Programada (${new Date(c.effectiveDate!).toLocaleDateString("es-AR")})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-[#0F172A]">
                      {c.tenureDays} días
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-[#0F172A]">
                      ${c.historicalRevenue.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#991B1B] uppercase">
                        {getReasonLabel(c.reason)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] max-w-xs truncate">
                      {c.comment || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/super-admin/customers/${c.tenantId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#3A86FF] hover:bg-[#EFF6FF] rounded-md transition-colors"
                      >
                        <span>Detalle</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
