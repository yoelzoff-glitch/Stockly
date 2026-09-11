import { createAdminClient } from "@/lib/supabase/admin";
import { Layers, Check, Users, ShoppingBag, ShieldCheck } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminPlansPage() {
  const adminDb = createAdminClient();

  const { data: plans } = await adminDb
    .from("plans")
    .select("*")
    .order("price_monthly", { ascending: true });

  const allPlans = plans || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Catálogo de Planes SaaS
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Configuración de tiers, límites de usuarios, cuentas de Mercado Libre y precios.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#334155]">
          <Layers className="w-4 h-4 text-[#3A86FF]" />
          <span>{allPlans.length} planes configurados</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {allPlans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#3A86FF]">
                  {plan.code}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    plan.is_active
                      ? "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
                      : "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
                  }`}
                >
                  {plan.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-[#0F172A]">{plan.name}</h3>
                <p className="text-xs text-[#64748B] mt-1 min-h-[32px]">{plan.description}</p>
              </div>

              <div className="pt-2 border-t border-[#F1F5F9]">
                <div className="text-2xl font-black text-[#0F172A]">
                  $ {Number(plan.price_monthly).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  <span className="text-xs font-normal text-[#64748B]"> / mes</span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Anual: $ {Number(plan.price_yearly).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-2 pt-2 border-t border-[#F1F5F9] text-xs">
                <div className="flex items-center justify-between text-[#334155]">
                  <span className="flex items-center gap-1.5 text-[#64748B]">
                    <Users className="w-3.5 h-3.5" />
                    <span>Usuarios máximos:</span>
                  </span>
                  <strong className="text-[#0F172A]">{plan.max_users}</strong>
                </div>
                <div className="flex items-center justify-between text-[#334155]">
                  <span className="flex items-center gap-1.5 text-[#64748B]">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Cuentas Mercado Libre:</span>
                  </span>
                  <strong className="text-[#0F172A]">{plan.max_ml_accounts}</strong>
                </div>
              </div>

              {/* Features */}
              {plan.features && Object.keys(plan.features).length > 0 && (
                <div className="pt-2 border-t border-[#F1F5F9] space-y-2 text-xs text-[#475569]">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8] block">
                    Características
                  </span>
                  {Object.entries(plan.features).map(([k, v]) => {
                    let label = `${k.replace(/_/g, " ")}: ${String(v)}`;
                    if (k === "sku_limit") label = `Hasta ${Number(v).toLocaleString("es-AR")} SKUs activos`;
                    else if (k === "ai_actions") label = `${Number(v).toLocaleString("es-AR")} consultas de IA mensuales`;
                    else if (k === "automation_limit") label = `${Number(v).toLocaleString("es-AR")} procesos automáticos`;
                    else if (k === "whatsapp_accounts") label = v === 1 ? "1 número de WhatsApp vinculado" : `Hasta ${v} números de WhatsApp vinculados`;
                    else if (k === "free_trial_days") label = `${v} días de prueba gratis`;
                    else if (k === "fee_audit") label = "Auditoría de comisiones y margen neto";
                    else if (k === "shipping_monitoring") label = "Monitoreo de órdenes y costos de envío";
                    else if (k === "internal_stock") label = "Control de stock interno en depósito";
                    else if (k === "ads_management") label = "Cálculo de rentabilidad sobre ML Ads";
                    else if (k === "priority_support") label = "Soporte prioritario por canales directos";
                    else if (k === "combo_tracking") label = "Seguimiento de combos sin descalce de insumos";
                    else if (k === "preventive_stock_alerts") label = "Alertas preventivas de quiebre de stock";

                    return (
                      <div key={k} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8]">
              ID: <span className="font-mono">{plan.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
