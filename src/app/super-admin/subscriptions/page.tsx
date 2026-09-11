import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreditCard, ExternalLink, Calendar, DollarSign } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminSubscriptionsPage() {
  const adminDb = createAdminClient();

  const [
    { data: subscriptions },
    { data: tenants },
    { data: plans },
  ] = await Promise.all([
    adminDb.from("subscriptions").select("*").order("created_at", { ascending: false }),
    adminDb.from("tenants").select("id, name, slug"),
    adminDb.from("plans").select("id, code, name"),
  ]);

  const tenantMap = new Map((tenants || []).map((t) => [t.id, t.name]));
  const planMap = new Map((plans || []).map((p) => [p.code, p.name]));
  const planById = new Map((plans || []).map((p) => [p.id, p.name]));

  const list = (subscriptions || []).map((sub) => {
    const tenantName = tenantMap.get(sub.tenant_id) || "Desconocido";
    const planName =
      (sub.plan_id && planById.get(sub.plan_id)) ||
      planMap.get(sub.plan) ||
      sub.plan?.toUpperCase() ||
      "—";

    return {
      id: sub.id,
      tenantId: sub.tenant_id,
      tenantName,
      planCode: sub.plan,
      planName,
      status: sub.status,
      monthlyPrice: Number(sub.monthly_price_snapshot || 0),
      currentPeriodEnd: sub.current_period_end,
      trialEndsAt: sub.trial_ends_at,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      createdAt: sub.created_at,
    };
  });

  const getBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]";
      case "trialing":
        return "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
      case "past_due":
        return "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]";
      case "cancelled":
        return "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";
      case "paused":
        return "bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]";
      default:
        return "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Suscripciones de Plataforma
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitoreo global de contratos activos, vencimientos y estados de facturación.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#334155]">
          <CreditCard className="w-4 h-4 text-[#3A86FF]" />
          <span>{list.length} suscripciones registradas</span>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] uppercase font-bold text-[#64748B] bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Precio Snapshot</th>
                <th className="px-4 py-3">Período / Trial Fin</th>
                <th className="px-4 py-3">Baja Programada</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#64748B]">
                    No hay suscripciones registradas.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#0F172A]">{item.tenantName}</div>
                      <div className="text-[10px] text-[#94A3B8] font-mono">{item.tenantId}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold uppercase text-[#1E293B]">
                      {item.planName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#0F172A]">
                      $ {item.monthlyPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {item.status === "trialing" && item.trialEndsAt
                        ? `Trial: ${new Date(item.trialEndsAt).toLocaleDateString("es-AR")}`
                        : item.currentPeriodEnd
                        ? new Date(item.currentPeriodEnd).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.cancelAtPeriodEnd ? (
                        <span className="text-[10px] font-bold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded">
                          Sí (al vencer)
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] text-[11px]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/super-admin/customers/${item.tenantId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#3A86FF] hover:bg-[#EFF6FF] rounded-md transition-colors"
                      >
                        <span>Gestionar</span>
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
