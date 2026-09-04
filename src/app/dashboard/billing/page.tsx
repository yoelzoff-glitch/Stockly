"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, CreditCard, AlertCircle } from "lucide-react"
import { upgradePlan, scheduleDowngradeAction } from "./actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
    <div className="flex-1 space-y-6 p-8 pt-6">
      {isExpired && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Suscripción Vencida</AlertTitle>
          <AlertDescription>
            Tu plan actual ha expirado. Por favor, renueva tu suscripción para seguir utilizando Klyvo.
            Tus datos están a salvo, pero el acceso está restringido hasta que regularices el pago.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Facturación y Planes</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle>Uso de Inteligencia Artificial</CardTitle>
            <CardDescription>
              Consultas realizadas a través del Agente IA o WhatsApp en el mes actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{usage.ai_credits_used || 0} consultas usadas</span>
              <span>{isUnlimited ? '∞' : limit} límite</span>
            </div>
            <Progress value={isUnlimited ? 0 : progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? "Tu plan no tiene límite de consultas." : `Has usado el ${progress}% de tu límite mensual.`}
            </p>
          </CardContent>
        </Card>

        {/* SKUs Card */}
        <Card>
          <CardHeader>
            <CardTitle>SKUs de Catálogo</CardTitle>
            <CardDescription>
              SKUs únicos importados y sincronizados activamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{stats.pubCount || 0} SKUs únicos importados</span>
              <span>{isUnlimited ? '∞' : pubLimit} límite</span>
            </div>
            <Progress value={isUnlimited ? 0 : pubProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? "Tu plan no tiene límite de SKUs." : `Has usado el ${pubProgress}% de tu límite de SKUs.`}
            </p>
          </CardContent>
        </Card>

        {/* Automated Processes Card */}
        <Card>
          <CardHeader>
            <CardTitle>Procesos Automatizados</CardTitle>
            <CardDescription>
              Acciones automáticas ejecutadas por Klyvo sobre tu catálogo en el mes actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{usage.automation_actions_used || 0} procesos usados</span>
              <span>{isUnlimited ? '∞' : autoLimit} límite</span>
            </div>
            <Progress value={isUnlimited ? 0 : autoProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? "Tu plan no tiene límite de procesos automáticos." : `Has usado el ${autoProgress}% de tu límite mensual.`}
            </p>
          </CardContent>
        </Card>

        {/* Current Plan Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Plan Actual: {subscription.plan.toUpperCase()}</CardTitle>
            <CardDescription>
              Estado: <span className="capitalize font-semibold">{subscription.status}</span>
              {subscription.pending_plan && (
                <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Baja programada a {subscription.pending_plan.toUpperCase()}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Funcionalidades base de Klyvo</span>
            </div>
            <div className="flex items-center space-x-2 text-sm mt-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{isUnlimited ? 'Consultas IA ilimitadas' : `${limit} consultas IA/mes`}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm mt-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{isUnlimited ? 'Procesos automáticos ilimitados' : `${autoLimit} procesos automáticos/mes`}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-xl font-bold mt-10">Mejora tu Plan</h3>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Starter Plan */}
        <Card className={subscription.plan === 'starter' ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Starter</CardTitle>
            <CardDescription>Para pequeños vendedores.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$49.99 <span className="text-xs font-normal text-muted-foreground">USD/mes</span></div>
            <div className="text-xs text-slate-400 font-medium mt-1">equiv. $78.984 ARS / mes (Mercado Pago)</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>15 días de prueba gratis</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 100 SKUs de catálogo (sin límite de publicaciones)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>500 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>250 procesos automáticos mensuales</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Gestión de Títulos con IA</span></div>
          </CardContent>
          <CardFooter>
            {subscription.plan === 'starter' && !isExpired ? (
              <Button className="w-full" disabled variant="secondary">
                Plan Actual
              </Button>
            ) : (
              <Button 
                className="w-full" 
                onClick={() => handleUpgrade('starter')} 
                disabled={!!upgrading || !!downgrading || (!isExpired && subscription.plan === 'starter') || subscription.pending_plan === 'starter'}
                variant={subscription.plan === 'pro' || subscription.plan === 'ultra' ? "outline" : "default"}
              >
                {upgrading === 'starter' || downgrading === 'starter' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {subscription.plan === 'starter' && isExpired ? 'Pagar Starter' : (subscription.plan === 'pro' || subscription.plan === 'ultra' ? 'Bajar a Starter' : 'Seleccionar Starter')}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card className={subscription.plan === 'pro' ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Para tiendas en crecimiento.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$79.99 <span className="text-xs font-normal text-muted-foreground">USD/mes</span></div>
            <div className="text-xs text-slate-400 font-medium mt-1">equiv. $126.384 ARS / mes (Mercado Pago)</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>15 días de prueba gratis</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 400 SKUs de catálogo (sin límite de publicaciones)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>1.500 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>800 procesos automáticos mensuales</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 2 números de WhatsApp vinculados</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Soporte prioritario</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Optimización y Cambio Masivo de Títulos</span></div>
          </CardContent>
          <CardFooter>
            {subscription.plan === 'pro' ? (
              <Button className="w-full" disabled variant="secondary">Plan Actual</Button>
            ) : (
              <Button className="w-full" onClick={() => handleUpgrade('pro')} disabled={!!upgrading || !!downgrading || subscription.pending_plan === 'pro'} variant={subscription.plan === 'ultra' ? "outline" : "default"}>
                {upgrading === 'pro' || downgrading === 'pro' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {subscription.plan === 'ultra' ? 'Bajar a Pro' : 'Actualizar a Pro'}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Ultra Plan */}
        <Card className={subscription.plan === 'ultra' ? "border-primary" : "border-primary/50 bg-primary/5"}>
          <CardHeader>
            <CardTitle>Ultra</CardTitle>
            <CardDescription>Para negocios a gran escala.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$129.99 <span className="text-xs font-normal text-muted-foreground">USD/mes</span></div>
            <div className="text-xs text-slate-400 font-medium mt-1">equiv. $205.384 ARS / mes (Mercado Pago)</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 1.000 SKUs de catálogo (sin límite de publicaciones)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>5.000 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 1.500 procesos automáticos</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 2 números de WhatsApp vinculados</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Soporte 24/7 por WhatsApp</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Optimización y Cambio Masivo de Títulos</span></div>
          </CardContent>
          <CardFooter>
            {subscription.plan === 'ultra' ? (
              <Button className="w-full" disabled variant="secondary">Plan Actual</Button>
            ) : (
              <Button className="w-full" onClick={() => handleUpgrade('ultra')} disabled={!!upgrading}>
                {upgrading === 'ultra' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Actualizar a Ultra
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isDowngradeModalOpen} onOpenChange={setIsDowngradeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Baja de Plan</DialogTitle>
            <DialogDescription>
              Tu plan {subscription?.plan?.toUpperCase()} se mantendrá activo hasta el final de tu ciclo de facturación actual. A partir de ese momento, tu suscripción se cancelará para que no se te vuelva a cobrar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-600">
            <p>Al inicio del próximo mes, tu cuenta pasará a ser {targetDowngrade?.toUpperCase()}, y se te pedirá que ingreses tu tarjeta nuevamente para suscribirte a la nueva tarifa.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDowngradeModalOpen(false)} disabled={!!downgrading}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDowngrade} disabled={!!downgrading}>
              {downgrading ? "Procesando..." : "Sí, programar baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
