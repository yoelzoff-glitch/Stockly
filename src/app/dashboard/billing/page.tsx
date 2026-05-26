"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, CreditCard } from "lucide-react"
import { upgradePlan } from "./actions"

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadBilling() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
      if (profile?.tenant_id) {
        const { data: usage } = await supabase.from("subscription_usage").select("*").eq("tenant_id", profile.tenant_id).single()
        const { data: sub } = await supabase.from("subscriptions").select("*").eq("tenant_id", profile.tenant_id).single()
        
        setStats({
          usage: usage || { ai_requests_used: 0, ai_requests_limit: 500 },
          subscription: sub || { plan: 'starter', status: 'active' }
        })
      }
      setLoading(false)
    }
    loadBilling()
  }, [])

  const handleUpgrade = async (plan: 'pro' | 'ultra') => {
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { usage, subscription } = stats
  const progress = Math.min(100, Math.round((usage.ai_requests_used / usage.ai_requests_limit) * 100))
  const isUnlimited = subscription.plan === 'ultra'

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
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
              <span>{usage.ai_requests_used} consultas usadas</span>
              <span>{isUnlimited ? '∞' : usage.ai_requests_limit} límite</span>
            </div>
            <Progress value={isUnlimited ? 0 : progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? "Tu plan no tiene límite de consultas." : `Has usado el ${progress}% de tu límite mensual.`}
            </p>
          </CardContent>
        </Card>

        {/* Current Plan Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Plan Actual: {subscription.plan.toUpperCase()}</CardTitle>
            <CardDescription>
              Estado: <span className="capitalize font-semibold">{subscription.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Funcionalidades base de Stockly</span>
            </div>
            <div className="flex items-center space-x-2 text-sm mt-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{isUnlimited ? 'Consultas IA ilimitadas' : `${usage.ai_requests_limit} consultas IA/mes`}</span>
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
            <div className="mt-4 text-3xl font-bold">$25.000 <span className="text-sm font-normal text-muted-foreground">ARS/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>500 consultas IA/mes</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>1 Usuario</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>1 Cuenta de Mercado Libre</span></div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled variant={subscription.plan === 'starter' ? "secondary" : "outline"}>
              {subscription.plan === 'starter' ? 'Plan Actual' : 'No disponible'}
            </Button>
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card className={subscription.plan === 'pro' ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Para tiendas en crecimiento.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$49.000 <span className="text-sm font-normal text-muted-foreground">ARS/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>5.000 consultas IA/mes</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>5 Usuarios</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Múltiples cuentas Mercado Libre</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Soporte prioritario</span></div>
          </CardContent>
          <CardFooter>
            {subscription.plan === 'pro' ? (
              <Button className="w-full" disabled variant="secondary">Plan Actual</Button>
            ) : (
              <Button className="w-full" onClick={() => handleUpgrade('pro')} disabled={!!upgrading || subscription.plan === 'ultra'}>
                {upgrading === 'pro' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Actualizar a Pro
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Ultra Plan */}
        <Card className={subscription.plan === 'ultra' ? "border-primary" : "border-primary/50 bg-primary/5"}>
          <CardHeader>
            <CardTitle>Ultra</CardTitle>
            <CardDescription>Para negocios a gran escala.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$89.000 <span className="text-sm font-normal text-muted-foreground">ARS/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Consultas IA Ilimitadas</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Usuarios Ilimitados</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Cuentas Mercado Libre Ilimitadas</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Soporte 24/7 por WhatsApp</span></div>
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
    </div>
  )
}
