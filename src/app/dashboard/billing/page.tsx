"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Check, Loader2, CreditCard, AlertCircle, Calendar, ShieldCheck, ArrowDownCircle, Zap } from "lucide-react"
import { upgradePlan, scheduleDowngradeAction } from "./actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { OperationalPageHeader } from "@/components/operational/page-header"
import { StatusBadge } from "@/components/ui/status-badge"

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [downgrading, setDowngrading] = useState<string | null>(null)
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false)
  const [targetDowngrade, setTargetDowngrade] = useState<'starter' | 'pro' | null>(null)
  const [stats, setStats] = useState<any>(null)
  const searchParams = useSearchParams()
  const isExpired = searchParams.get("expired") === "true"
  const supabase = createClient()

  useEffect(() => {
    async function loadBilling() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
      if (profile?.tenant_id) {
        const currentMonth = new Date().toISOString().slice(0, 7) + "-01"
        const { data: usage } = await supabase
          .from("subscription_usage")
          .select("id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used")
          .eq("tenant_id", profile.tenant_id)
          .eq("month", currentMonth)
          .maybeSingle()

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, plan, status, expires_at, pending_plan")
          .eq("tenant_id", profile.tenant_id)
          .maybeSingle()

        const { data: plans } = await supabase
          .from("plans_config")
          .select("plan_key, ai_credits_limit, automation_limit, whatsapp_limit, sku_limit, price_monthly")
          .eq("is_active", true)

        const { data: products } = await supabase
          .from("products")
          .select("id, sku")
          .eq("tenant_id", profile.tenant_id)
          .neq("status", "deleted_from_meli")

        const skus = products?.map((p, idx) => p.sku || `no-sku-${idx}`) || []
        const uniqueSkuCount = new Set(skus).size

        const plansMap: Record<string, any> = {}
        if (plans) {
          for (const p of plans) {
            plansMap[p.plan_key] = p
          }
        }

        setStats({
          usage: usage || { ai_credits_used: 0, whatsapp_messages_used: 0, automation_actions_used: 0 },
          subscription: sub || { plan: "starter", status: "active", expires_at: null, pending_plan: null },
          pubCount: uniqueSkuCount,
          plansConfig: plansMap,
        })
      }
      setLoading(false)
    }
    loadBilling()
  }, [])

  const getPlanWeight = (p: string) => (p === "ultra" ? 3 : p === "pro" ? 2 : 1)

  const handleUpgrade = async (plan: "starter" | "pro" | "ultra") => {
    if (getPlanWeight(plan) < getPlanWeight(stats?.subscription?.plan)) {
      setTargetDowngrade(plan as "starter" | "pro")
      setIsDowngradeModalOpen(true)
      return
    }

    setUpgrading(plan)
    try {
      const initPoint = await upgradePlan(plan)
      if (initPoint) {
        window.location.href = initPoint
      }
    } catch (error) {
      console.error(error)
      alert("Hubo un error al iniciar el pago")
    } finally {
      setUpgrading(null)
    }
  }

  const confirmDowngrade = async () => {
    if (!targetDowngrade) return
    setDowngrading(targetDowngrade)
    try {
      await scheduleDowngradeAction(targetDowngrade)
      setStats({
        ...stats,
        subscription: {
          ...stats.subscription,
          pending_plan: targetDowngrade,
        },
      })
      setIsDowngradeModalOpen(false)
    } catch (error: any) {
      alert("Error al programar la baja: " + error.message)
    } finally {
      setDowngrading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#5F6875]">
          <Loader2 className="h-4 w-4 animate-spin text-[#102A56]" />
          <span>Cargando estado de suscripción...</span>
        </div>
      </div>
    )
  }

  const { usage, subscription, plansConfig } = stats
  const currentPlanKey = subscription.plan === "business" ? "ultra" : subscription.plan === "free" ? "starter" : subscription.plan || "starter"
  const currentPlanCfg = plansConfig?.[currentPlanKey]

  const limit = currentPlanCfg?.ai_credits_limit || (currentPlanKey === "ultra" ? 5000 : currentPlanKey === "pro" ? 1500 : 500)
  const pubLimit = currentPlanCfg?.sku_limit || (currentPlanKey === "ultra" ? 1000 : currentPlanKey === "pro" ? 400 : 100)
  const autoLimit = currentPlanCfg?.automation_limit || (currentPlanKey === "ultra" ? 1500 : currentPlanKey === "pro" ? 800 : 250)

  const progress = Math.min(100, Math.round(((usage.ai_credits_used || 0) / limit) * 100))
  const pubProgress = Math.min(100, Math.round(((stats.pubCount || 0) / pubLimit) * 100))
  const autoProgress = Math.min(100, Math.round(((usage.automation_actions_used || 0) / autoLimit) * 100))
  const isUnlimited = false

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Facturación y suscripción"
        description="Gestión de planes, cuotas operativas mensuales y consumo de catálogo."
        status={
          <StatusBadge
            variant={isExpired ? "danger" : subscription.status === "active" ? "success" : "warning"}
          >
            {isExpired ? "Vencida" : subscription.status === "active" ? "Plan Activo" : subscription.status}
          </StatusBadge>
        }
      />

      {isExpired && (
        <Alert variant="destructive" className="border-[#D92D20]/40 bg-[#FEF3F2]">
          <AlertCircle className="h-4 w-4 text-[#D92D20]" />
          <AlertTitle className="text-[#D92D20] font-bold">Suscripción Vencida</AlertTitle>
          <AlertDescription className="text-[#5F6875] text-xs mt-1">
            Tu plan actual ha expirado. Por favor, regulariza tu suscripción para reanudar el acceso completo a Klyvo.
            Tus datos de catálogo, costos y configuraciones se encuentran a salvo.
          </AlertDescription>
        </Alert>
      )}

      {/* Plan summary strip & usage */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current plan card */}
        <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#5F6875] uppercase tracking-wider block">
              Plan vigente
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#101828] uppercase">
                {subscription.plan}
              </span>
              <StatusBadge variant="neutral">
                {subscription.status}
              </StatusBadge>
            </div>
            {subscription.pending_plan && (
              <div className="text-[11px] text-[#B54708] bg-[#FEF6EE] px-2 py-1 rounded border border-[#F9DBAF] mt-2 flex items-center gap-1.5">
                <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Baja a {subscription.pending_plan.toUpperCase()} programada</span>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-[#DCDAD4]/60 text-xs text-[#5F6875] space-y-1">
            <div className="flex justify-between">
              <span>Procesador:</span>
              <span className="font-semibold text-[#101828]">Mercado Pago</span>
            </div>
            <div className="flex justify-between">
              <span>Renovación:</span>
              <span className="font-semibold text-[#101828]">
                {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString("es-AR") : "Mensual automática"}
              </span>
            </div>
          </div>
        </div>

        {/* SKUs usage card */}
        <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5F6875] uppercase tracking-wider">
              SKUs de catálogo
            </span>
            <span className="text-xs font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {stats.pubCount || 0} / {isUnlimited ? "∞" : pubLimit}
            </span>
          </div>
          <div className="w-full bg-[#F5F3EE] h-2 rounded-full overflow-hidden border border-[#DCDAD4]/40">
            <div
              className={`h-full transition-all duration-300 ${pubProgress > 90 ? "bg-[#D92D20]" : "bg-[#102A56]"}`}
              style={{ width: `${pubProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-[#5F6875]">
            {isUnlimited ? "Sin límite de SKUs." : `${pubProgress}% del límite mensual utilizado.`}
          </p>
        </div>

        {/* AI Queries usage card */}
        <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5F6875] uppercase tracking-wider">
              Consultas operativas
            </span>
            <span className="text-xs font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {usage.ai_credits_used || 0} / {isUnlimited ? "∞" : limit}
            </span>
          </div>
          <div className="w-full bg-[#F5F3EE] h-2 rounded-full overflow-hidden border border-[#DCDAD4]/40">
            <div
              className={`h-full transition-all duration-300 ${progress > 90 ? "bg-[#D92D20]" : "bg-[#102A56]"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-[#5F6875]">
            {isUnlimited ? "Sin límite mensual." : `${progress}% de consultas utilizadas este mes.`}
          </p>
        </div>

        {/* Automated Processes usage card */}
        <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5F6875] uppercase tracking-wider">
              Procesos automáticos
            </span>
            <span className="text-xs font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {usage.automation_actions_used || 0} / {isUnlimited ? "∞" : autoLimit}
            </span>
          </div>
          <div className="w-full bg-[#F5F3EE] h-2 rounded-full overflow-hidden border border-[#DCDAD4]/40">
            <div
              className={`h-full transition-all duration-300 ${autoProgress > 90 ? "bg-[#D92D20]" : "bg-[#102A56]"}`}
              style={{ width: `${autoProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-[#5F6875]">
            {isUnlimited ? "Sin límite de procesos." : `${autoProgress}% de ejecuciones utilizadas.`}
          </p>
        </div>
      </div>

      {/* Plan selection grid */}
      <div className="space-y-4 pt-2">
        <div className="border-b border-[#DCDAD4] pb-3">
          <h2 className="text-base font-bold text-[#101828]">
            Planes y suscripciones disponibles
          </h2>
          <p className="text-xs text-[#5F6875] mt-0.5">
            Selecciona el plan que se adapte al volumen de tu catálogo y operaciones.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Starter Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between shadow-xs transition-colors ${subscription.plan === 'starter' ? "border-[#102A56] bg-[#FFFFFF] ring-1 ring-[#102A56]" : "border-[#DCDAD4] bg-[#FFFFFF]"}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#101828]">Starter</h3>
                  <p className="text-xs text-[#5F6875]">Vendedores individuales o tiendas iniciales.</p>
                </div>
                {subscription.plan === 'starter' && (
                  <StatusBadge variant="info">Actual</StatusBadge>
                )}
              </div>

              <div className="border-y border-[#DCDAD4]/60 py-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    $49.99
                  </span>
                  <span className="text-xs text-[#5F6875] font-medium">USD / mes</span>
                </div>
                <p className="text-[11px] text-[#5F6875] mt-0.5 font-mono">
                  equiv. $78.984 ARS / mes (Mercado Pago)
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-[#101828]">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>15 días de prueba inicial sin costo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 100 SKUs únicos de catálogo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>500 consultas operativas por mes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>250 procesos automáticos mensuales</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Control de stock y rentabilidad por producto</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-[#DCDAD4]/60">
              {subscription.plan === 'starter' && !isExpired ? (
                <Button className="w-full bg-[#F5F3EE] text-[#5F6875] border border-[#DCDAD4]" disabled variant="outline">
                  Plan actual
                </Button>
              ) : (
                <Button
                  className="w-full bg-[#102A56] hover:bg-[#0A1D3C] text-white"
                  onClick={() => handleUpgrade('starter')}
                  disabled={!!upgrading || !!downgrading || (!isExpired && subscription.plan === 'starter') || subscription.pending_plan === 'starter'}
                  variant={subscription.plan === 'pro' || subscription.plan === 'ultra' ? "outline" : "default"}
                >
                  {upgrading === 'starter' || downgrading === 'starter' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  {subscription.plan === 'starter' && isExpired ? 'Pagar Starter' : (subscription.plan === 'pro' || subscription.plan === 'ultra' ? 'Bajar a Starter' : 'Seleccionar Starter')}
                </Button>
              )}
            </div>
          </div>

          {/* Pro Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between shadow-xs transition-colors ${subscription.plan === 'pro' ? "border-[#102A56] bg-[#FFFFFF] ring-1 ring-[#102A56]" : "border-[#DCDAD4] bg-[#FFFFFF]"}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#101828]">Pro</h3>
                  <p className="text-xs text-[#5F6875]">Tiendas medianas en crecimiento sostenido.</p>
                </div>
                {subscription.plan === 'pro' && (
                  <StatusBadge variant="info">Actual</StatusBadge>
                )}
              </div>

              <div className="border-y border-[#DCDAD4]/60 py-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    $79.99
                  </span>
                  <span className="text-xs text-[#5F6875] font-medium">USD / mes</span>
                </div>
                <p className="text-[11px] text-[#5F6875] mt-0.5 font-mono">
                  equiv. $126.384 ARS / mes (Mercado Pago)
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-[#101828]">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>15 días de prueba inicial sin costo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 400 SKUs únicos de catálogo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>1.500 consultas operativas por mes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>800 procesos automáticos mensuales</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 2 números de WhatsApp vinculados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Soporte prioritario por canal operativo</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-[#DCDAD4]/60">
              {subscription.plan === 'pro' ? (
                <Button className="w-full bg-[#F5F3EE] text-[#5F6875] border border-[#DCDAD4]" disabled variant="outline">
                  Plan actual
                </Button>
              ) : (
                <Button
                  className="w-full bg-[#102A56] hover:bg-[#0A1D3C] text-white"
                  onClick={() => handleUpgrade('pro')}
                  disabled={!!upgrading || !!downgrading || subscription.pending_plan === 'pro'}
                  variant={subscription.plan === 'ultra' ? "outline" : "default"}
                >
                  {upgrading === 'pro' || downgrading === 'pro' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  {subscription.plan === 'ultra' ? 'Bajar a Pro' : 'Actualizar a Pro'}
                </Button>
              )}
            </div>
          </div>

          {/* Ultra Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between shadow-xs transition-colors ${subscription.plan === 'ultra' ? "border-[#102A56] bg-[#FFFFFF] ring-1 ring-[#102A56]" : "border-[#DCDAD4] bg-[#FFFFFF]"}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#101828]">Ultra</h3>
                  <p className="text-xs text-[#5F6875]">Cuentas de alto volumen y operaciones complejas.</p>
                </div>
                {subscription.plan === 'ultra' && (
                  <StatusBadge variant="info">Actual</StatusBadge>
                )}
              </div>

              <div className="border-y border-[#DCDAD4]/60 py-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    $129.99
                  </span>
                  <span className="text-xs text-[#5F6875] font-medium">USD / mes</span>
                </div>
                <p className="text-[11px] text-[#5F6875] mt-0.5 font-mono">
                  equiv. $205.384 ARS / mes (Mercado Pago)
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-[#101828]">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 1.000 SKUs de catálogo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>5.000 consultas operativas por mes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 1.500 procesos automáticos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Hasta 2 números de WhatsApp vinculados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#198754] shrink-0" />
                  <span>Soporte 24/7 operativo directo</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-4 border-t border-[#DCDAD4]/60">
              {subscription.plan === 'ultra' ? (
                <Button className="w-full bg-[#F5F3EE] text-[#5F6875] border border-[#DCDAD4]" disabled variant="outline">
                  Plan actual
                </Button>
              ) : (
                <Button
                  className="w-full bg-[#102A56] hover:bg-[#0A1D3C] text-white"
                  onClick={() => handleUpgrade('ultra')}
                  disabled={!!upgrading}
                >
                  {upgrading === 'ultra' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Actualizar a Ultra
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDowngradeModalOpen} onOpenChange={setIsDowngradeModalOpen}>
        <DialogContent className="border-[#DCDAD4] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Confirmar cambio de plan
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875] mt-1.5">
              Tu plan {subscription?.plan?.toUpperCase()} continuará vigente hasta finalizar tu ciclo de facturación actual.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-xs text-[#5F6875] space-y-2">
            <p>
              Al cumplirse la fecha de vencimiento, la suscripción actual finalizará y tu cuenta se ajustará al plan {targetDowngrade?.toUpperCase()}.
            </p>
            <p>
              Podrás actualizar tus datos de pago en Mercado Pago para activar el nuevo período.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDowngradeModalOpen(false)}
              disabled={!!downgrading}
              className="border-[#DCDAD4] text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDowngrade}
              disabled={!!downgrading}
              className="text-xs font-semibold"
            >
              {downgrading ? "Procesando..." : "Confirmar programación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
