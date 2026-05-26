"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, CreditCard, AlertCircle } from "lucide-react"
import { upgradePlan } from "./actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
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

  const handleUpgrade = async (plan: 'starter' | 'pro' | 'ultra') => {
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
  
  let limit = usage.ai_requests_limit || 500;
  if (subscription.plan === 'pro') limit = 1500;
  if (subscription.plan === 'ultra') limit = 10000;
  
  const progress = Math.min(100, Math.round(((usage.ai_requests_used || 0) / limit) * 100))
  const isUnlimited = false;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {isExpired && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Suscripción Vencida</AlertTitle>
          <AlertDescription>
            Tu plan actual ha expirado. Por favor, renueva tu suscripción para seguir utilizando Stockly.
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
              <span>{usage.ai_requests_used || 0} consultas usadas</span>
              <span>{isUnlimited ? '∞' : limit} límite</span>
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
              <span>{isUnlimited ? 'Consultas IA ilimitadas' : `${limit} consultas IA/mes`}</span>
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
            <div className="mt-4 text-3xl font-bold">$25 <span className="text-sm font-normal text-muted-foreground">USD/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>7 días de prueba gratis</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 100 publicaciones de ML</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>500 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>250 procesos automáticos mensuales</span></div>
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
                disabled={!!upgrading || (!isExpired && subscription.plan !== 'starter')}
                variant={!isExpired && subscription.plan !== 'starter' ? "outline" : "default"}
              >
                {upgrading === 'starter' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {subscription.plan === 'starter' && isExpired ? 'Pagar Starter' : 'Seleccionar Starter'}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card className={subscription.plan === 'pro' ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Para tiendas en crecimiento.</CardDescription>
            <div className="mt-4 text-3xl font-bold">$49 <span className="text-sm font-normal text-muted-foreground">USD/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 500 publicaciones de ML</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>1.500 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>800 procesos automáticos mensuales</span></div>
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
            <div className="mt-4 text-3xl font-bold">$89 <span className="text-sm font-normal text-muted-foreground">USD/mes</span></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 2.500 publicaciones de ML</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>10.000 mensajes de IA (WhatsApp/Web)</span></div>
            <div className="flex items-center space-x-2"><Check className="h-4 w-4" /> <span>Hasta 5.000 procesos automáticos</span></div>
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
