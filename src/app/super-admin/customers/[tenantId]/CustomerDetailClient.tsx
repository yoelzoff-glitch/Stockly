"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CustomerDetailData } from "@/services/super-admin/customerDetail";
import {
  handleAssignPlan,
  handleChangePlan,
  handleExtendTrial,
  handleActivateSubscription,
  handlePauseSubscription,
  handleReactivateSubscription,
  handleCancelSubscription,
} from "@/app/super-admin/actions";
import {
  CreditCard,
  Calendar,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  Ban,
  CheckCircle2,
  ArrowLeft,
  ShoppingBag,
  Eye,
  FileText,
  RefreshCw,
  History,
} from "lucide-react";

interface CustomerDetailClientProps {
  data: CustomerDetailData;
}

export function CustomerDetailClient({ data }: CustomerDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState(
    data.availablePlans.find((p) => p.code === data.subscription?.planCode)?.id ||
      data.availablePlans[0]?.id ||
      ""
  );
  const [trialDays, setTrialDays] = useState(14);
  const [cancelReason, setCancelReason] = useState<any>("not_using");
  const [cancelComment, setCancelComment] = useState("");
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("non_payment");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sub = data.subscription;

  const onAssignOrCreatePlan = (isTrial: boolean) => {
    if (!selectedPlanId) return;
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleAssignPlan(data.tenant.id, selectedPlanId, "monthly", isTrial, trialDays);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: isTrial ? `Trial iniciado por ${trialDays} días.` : "Plan asignado y suscripción activada.",
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al asignar plan." });
      }
    });
  };

  const onChangePlan = () => {
    if (!selectedPlanId) return;
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleChangePlan(data.tenant.id, selectedPlanId);
      if (res.success) {
        setActionMessage({ type: "success", text: "Plan actualizado correctamente." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al cambiar plan." });
      }
    });
  };

  const onExtendTrial = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleExtendTrial(data.tenant.id, trialDays);
      if (res.success) {
        setActionMessage({ type: "success", text: `Trial extendido por ${trialDays} días más.` });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al extender trial." });
      }
    });
  };

  const onActivate = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleActivateSubscription(data.tenant.id);
      if (res.success) {
        setActionMessage({ type: "success", text: "Suscripción activada con éxito." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al activar suscripción." });
      }
    });
  };

  const onConfirmPause = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await handlePauseSubscription(data.tenant.id, pauseReason);
      setShowPauseModal(false);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: res.alreadyPaused
            ? "La suscripción ya se encontraba pausada."
            : "Suscripción pausada con éxito.",
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al pausar suscripción." });
      }
    });
  };

  const onReactivate = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleReactivateSubscription(data.tenant.id);
      if (res.success) {
        setActionMessage({ type: "success", text: "Suscripción reactivada con éxito." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al reactivar suscripción." });
      }
    });
  };

  const onConfirmCancel = () => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await handleCancelSubscription(
        data.tenant.id,
        cancelReason,
        cancelComment,
        cancelImmediate
      );
      setShowCancelModal(false);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: cancelImmediate
            ? "Suscripción cancelada inmediatamente."
            : "Cancelación programada para el final del período.",
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Error al cancelar suscripción." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between">
        <Link
          href="/super-admin/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Clientes</span>
        </Link>
        <div className="text-xs text-[#94A3B8] font-mono">Tenant ID: {data.tenant.id}</div>
      </div>

      {/* Header Profile Banner */}
      <div className="p-6 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0F172A]">{data.tenant.name}</h1>
            {data.tenant.isDemo && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                DEMO
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase border ${
                sub?.status === "active"
                  ? "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
                  : sub?.status === "paused"
                  ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]"
                  : sub?.status === "trialing"
                  ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]"
                  : sub?.status === "past_due"
                  ? "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]"
                  : "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
              }`}
            >
              {sub?.status === "paused" ? "PAUSADA" : sub?.status || "SIN SUSCRIPCIÓN"}
            </span>
          </div>
          <div className="text-xs text-[#64748B] flex flex-wrap gap-x-4 gap-y-1">
            <span>Owner: <strong className="text-[#0F172A]">{data.owner?.email || "Sin email"}</strong></span>
            <span>Alta: <strong className="text-[#0F172A]">{new Date(data.tenant.createdAt).toLocaleDateString("es-AR")}</strong></span>
            <span>
              Mercado Libre:{" "}
              <strong className={data.meliAccounts.length > 0 ? "text-[#10B981]" : "text-[#EF4444]"}>
                {data.meliAccounts.length > 0
                  ? `Conectado (${data.meliAccounts.length} cuenta/s)`
                  : "No conectado"}
              </strong>
            </span>
          </div>
        </div>

        {/* Health status badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Salud Actividad</div>
            <div className="text-sm font-black text-[#0F172A]">{data.activity.health}</div>
            <div className="text-[10px] text-[#94A3B8]">
              {data.activity.daysSinceLastActivity !== null
                ? `${data.activity.daysSinceLastActivity} días sin actividad`
                : "Tracking pendiente / Sin datos"}
            </div>
          </div>
        </div>
      </div>

      {/* Internal Debug Inspector (Requirement 16) */}
      <div className="p-4 rounded-xl bg-[#0B132B] text-white border border-[#1C2541] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#1C2541] pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
              Inspector de Diagnóstico Interno (Real Data)
            </span>
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">tenant_activity_state</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Subscription:</span>
            <strong className="text-[#38BDF8] uppercase font-mono">{data.inspector.subscriptionStatus}</strong>
          </div>
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Last Human Activity:</span>
            <strong className="text-white font-mono text-[11px]">
              {data.inspector.lastUserActivityAt
                ? new Date(data.inspector.lastUserActivityAt).toLocaleString("es-AR")
                : "NULL (Sin datos)"}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Last Login:</span>
            <strong className="text-[#A7F3D0] font-mono text-[11px]">
              {data.inspector.lastLoginAt
                ? new Date(data.inspector.lastLoginAt).toLocaleString("es-AR")
                : "NULL"}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Last ML Sync:</span>
            <strong className="text-[#FDE047] font-mono text-[11px]">
              {data.inspector.lastMlSyncAt
                ? new Date(data.inspector.lastMlSyncAt).toLocaleString("es-AR")
                : "NULL"}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Classification:</span>
            <strong className="text-white font-bold">{data.inspector.activityClassification}</strong>
          </div>
          <div>
            <span className="text-[10px] text-[#94A3B8] block">Reason:</span>
            <span className="text-[#CBD5E1] text-[11px] truncate block" title={data.inspector.classificationReason}>
              {data.inspector.classificationReason}
            </span>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
              : "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* 2-Column Grid: Subscription & Management Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Subscription Card */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#3A86FF]" />
              <span>Suscripción Actual</span>
            </h3>
            <span className="text-xs font-bold text-[#0F172A] uppercase">
              {sub?.planName || "Ninguno"}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Precio Mensual:</span>
              <span className="font-extrabold text-[#0F172A]">
                $ {sub ? sub.monthlyPriceSnapshot.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"} USD
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Intervalo:</span>
              <span className="font-semibold text-[#0F172A] capitalize">
                {sub?.billingInterval || "monthly"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Fin de Trial:</span>
              <span className="font-medium text-[#0F172A]">
                {sub?.trialEndsAt
                  ? new Date(sub.trialEndsAt).toLocaleDateString("es-AR")
                  : "—"}
              </span>
            </div>
            {sub?.status === "paused" && (
              <>
                <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Pausada el:</span>
                  <span className="font-bold text-[#D97706]">
                    {sub.pausedAt ? new Date(sub.pausedAt).toLocaleString("es-AR") : "Recientemente"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Motivo de Pausa:</span>
                  <span className="font-bold text-[#B45309] capitalize">
                    {sub.pauseReason === "non_payment"
                      ? "Falta de pago"
                      : sub.pauseReason === "customer_request"
                      ? "Solicitud del cliente"
                      : sub.pauseReason === "manual_review"
                      ? "Revisión administrativa"
                      : sub.pauseReason || "Otro"}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Fin de Período:</span>
              <span className="font-medium text-[#0F172A]">
                {sub?.currentPeriodEnd
                  ? new Date(sub.currentPeriodEnd).toLocaleDateString("es-AR")
                  : "—"}
              </span>
            </div>
            {sub?.cancelAtPeriodEnd && (
              <div className="p-2 rounded bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#991B1B] font-semibold">
                ⚠️ Cancelación programada para el {new Date(sub.currentPeriodEnd!).toLocaleDateString("es-AR")}
              </div>
            )}
            {sub?.cancelledAt && (
              <div className="p-2 rounded bg-[#F1F5F9] text-[11px] text-[#475569]">
                Cancelada el: {new Date(sub.cancelledAt).toLocaleDateString("es-AR")}
                {sub.cancellationReason && (
                  <div className="mt-0.5">Motivo: <strong>{sub.cancellationReason}</strong></div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Manual Management Actions Panel */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#3A86FF]" />
              <span>Gestión Manual Super Admin</span>
            </h3>
            <span className="text-[10px] text-[#94A3B8]">Validado con requirePlatformAdmin()</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Plan Selector */}
            <div className="space-y-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <label className="text-xs font-bold text-[#0F172A] block">
                Seleccionar Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                disabled={isPending}
                className="w-full py-1.5 px-2 text-xs rounded border border-[#CBD5E1] bg-white font-medium focus:ring-2 focus:ring-[#3A86FF]"
              >
                {data.availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — $ {p.priceMonthly.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/mes
                  </option>
                ))}
              </select>

              <div className="flex gap-2 pt-2">
                {sub ? (
                  <button
                    onClick={onChangePlan}
                    disabled={isPending}
                    className="flex-1 py-1.5 px-3 bg-[#3A86FF] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm transition-colors"
                  >
                    Cambiar Plan
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onAssignOrCreatePlan(false)}
                      disabled={isPending}
                      className="flex-1 py-1.5 px-2.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm transition-colors"
                    >
                      Asignar y Activar
                    </button>
                    <button
                      onClick={() => onAssignOrCreatePlan(true)}
                      disabled={isPending}
                      className="flex-1 py-1.5 px-2.5 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm transition-colors"
                    >
                      Asignar Trial
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Trial Extension */}
            <div className="space-y-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <label className="text-xs font-bold text-[#0F172A] block">
                Extensión de Trial
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  disabled={isPending}
                  className="w-20 py-1.5 px-2 text-xs rounded border border-[#CBD5E1] bg-white font-bold text-center"
                />
                <span className="text-xs text-[#64748B]">días adicionales</span>
              </div>
              <div className="pt-2">
                <button
                  onClick={onExtendTrial}
                  disabled={isPending || !sub}
                  className="w-full py-1.5 px-3 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm transition-colors"
                >
                  Extender Trial
                </button>
              </div>
            </div>
          </div>

          {/* Quick Lifecycle Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F1F5F9]">
            {sub?.status !== "active" && sub?.status !== "paused" && (
              <button
                onClick={onActivate}
                disabled={isPending || !sub}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Activar</span>
              </button>
            )}

            {sub?.status === "paused" && (
              <button
                onClick={onReactivate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Reactivar Cuenta</span>
              </button>
            )}

            {(sub?.status === "active" || sub?.status === "trialing" || sub?.status === "past_due") && (
              <button
                onClick={() => setShowPauseModal(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar Cuenta</span>
              </button>
            )}

            {(sub?.status === "paused" || sub?.status === "cancelled" || sub?.status === "expired") && (
              <button
                onClick={onReactivate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3A86FF] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reactivar</span>
              </button>
            )}

            {sub && sub.status !== "cancelled" && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-white text-xs font-bold rounded shadow-sm ml-auto"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancelar Suscripción</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 30-Day Usage & Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage 30 Days */}
        <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-3">
            <Eye className="w-4 h-4 text-[#3A86FF]" />
            <span>Uso de Plataforma (Últimos 30 días)</span>
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#0F172A]">{data.usage30d.dashboardViews}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Dashboard Views</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#0F172A]">{data.usage30d.profitabilityViews}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Rentabilidad</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#0F172A]">{data.usage30d.adsViews}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Ads Views</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#0F172A]">{data.usage30d.exports}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Exportaciones</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#0F172A]">{data.usage30d.syncs}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Syncs Ejecutados</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-lg font-black text-[#3A86FF]">{data.usage30d.totalEvents}</div>
              <div className="text-[10px] text-[#64748B] uppercase">Eventos Totales</div>
            </div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-3">
            <DollarSign className="w-4 h-4 text-[#10B981]" />
            <span>Revenue del Cliente</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <div className="text-[10px] font-bold text-[#166534] uppercase">Revenue Histórico</div>
              <div className="text-xl font-black text-[#15803D] mt-1">
                $ {data.revenue.historicalRevenue.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
              <div className="text-[10px] text-[#166534] mt-0.5">{data.revenue.paymentCount} pagos aprobados</div>
            </div>

            <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
              <div className="text-[10px] font-bold text-[#1E40AF] uppercase">Revenue (30d)</div>
              <div className="text-xl font-black text-[#1D4ED8] mt-1">
                $ {data.revenue.last30dRevenue.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
              <div className="text-[10px] text-[#1E40AF] mt-0.5">MRR actual: $ {data.revenue.currentMrr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</div>
            </div>
          </div>

          {/* Transactions quick list */}
          <div className="text-xs text-[#64748B]">
            {data.revenue.transactions.length === 0 ? (
              <p className="text-center py-2 text-[#94A3B8]">Sin transacciones registradas.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {data.revenue.transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-1 border-b border-[#F1F5F9] text-[11px]">
                    <span className="text-[#334155]">
                      {tx.type.toUpperCase()} • {new Date(tx.createdAt).toLocaleDateString("es-AR")}
                    </span>
                    <span className="font-bold text-[#0F172A]">
                      $ {tx.amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ({tx.status})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Events Timeline */}
      <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5 border-b border-[#E2E8F0] pb-3">
          <History className="w-4 h-4 text-[#3A86FF]" />
          <span>Historial de Eventos de Suscripción (Timeline)</span>
        </h3>

        {data.timeline.length === 0 ? (
          <p className="text-xs text-[#94A3B8] text-center py-4">Sin eventos registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {data.timeline.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-[#3A86FF] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="text-[#0F172A] font-bold uppercase text-[11px]">
                      {ev.eventType.replace(/_/g, " ")}
                    </strong>
                    <span className="text-[10px] text-[#94A3B8]">
                      {new Date(ev.createdAt).toLocaleString("es-AR")}
                    </span>
                  </div>
                  {Object.keys(ev.metadata).length > 0 && (
                    <div className="text-[11px] text-[#64748B] mt-0.5 font-mono truncate">
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pause Confirmation Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-[#D97706]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#0F172A]">Pausar Cuenta de Cliente</h3>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              <strong>{data.tenant.name}</strong> perderá temporalmente el acceso a LibretaX.
              Sus datos y la conexión con Mercado Libre permanecerán guardados con total seguridad.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1">Motivo de la pausa:</label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full p-2 border border-[#CBD5E1] rounded bg-white text-[#0F172A] font-medium"
                >
                  <option value="non_payment">Falta de pago (non_payment)</option>
                  <option value="customer_request">Solicitud del cliente (customer_request)</option>
                  <option value="manual_review">Revisión administrativa (manual_review)</option>
                  <option value="other">Otro motivo (other)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
              <button
                onClick={() => setShowPauseModal(false)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmPause}
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-bold rounded bg-[#F59E0B] text-white hover:bg-[#D97706] disabled:opacity-50"
              >
                Confirmar Pausa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-[#DC2626]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Confirmar Cancelación de Suscripción</h3>
            </div>

            <p className="text-xs text-[#64748B]">
              Selecciona el motivo y modalidad de cancelación para el tenant{" "}
              <strong>{data.tenant.name}</strong>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1">Motivo:</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2 border border-[#CBD5E1] rounded bg-white"
                >
                  <option value="too_expensive">Demasiado caro (too_expensive)</option>
                  <option value="missing_feature">Falta funcionalidad (missing_feature)</option>
                  <option value="not_using">No lo usa (not_using)</option>
                  <option value="technical_problems">Problemas técnicos (technical_problems)</option>
                  <option value="switched_product">Cambió de producto (switched_product)</option>
                  <option value="business_closed">Cierre del negocio (business_closed)</option>
                  <option value="other">Otro motivo (other)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1">Comentario adicional:</label>
                <textarea
                  value={cancelComment}
                  onChange={(e) => setCancelComment(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre la baja..."
                  className="w-full p-2 border border-[#CBD5E1] rounded resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="immediate"
                  checked={cancelImmediate}
                  onChange={(e) => setCancelImmediate(e.target.checked)}
                  className="rounded text-[#DC2626]"
                />
                <label htmlFor="immediate" className="text-xs font-semibold text-[#DC2626]">
                  Cancelar inmediatamente (no esperar al fin de período)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
              >
                Cerrar
              </button>
              <button
                onClick={onConfirmCancel}
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-bold rounded bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
