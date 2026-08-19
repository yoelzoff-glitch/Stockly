import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle, Bot } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

import { MeliCard } from "@/components/dashboard/meli-card";
import { OpenAIConfigModal, WhatsAppConfigModal } from "./client-page";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ meli?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Fetch Mercado Libre Account Details
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("id, status, token_expires_at, sync_error, last_success_refresh")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Check WhatsApp
  const { data: waAccount } = await supabase
    .from("whatsapp_numbers")
    .select("phone_number, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const meliStatus = meliAccount && meliAccount.status === "connected" ? "conectado" : meliAccount?.status === "error" ? "error" : "pendiente";
  
  let waStatus = "pendiente";
  if (waAccount && waAccount.status === "connected") {
    waStatus = "conectado";
  } else if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    waStatus = "conectado"; // Local dev fallback
  }
  
  // OpenAI relies on env var for now
  const openAIStatus = process.env.OPENAI_API_KEY ? "conectado" : "pendiente";

  // Fetch current AI Settings and Usage
  const { data: tenant } = await supabase.from("tenants").select("metadata").eq("id", tenantId).maybeSingle();
  const { data: usage } = await supabase.from("subscription_usage").select("ai_credits_used").eq("tenant_id", tenantId).maybeSingle();
  const aiModel = tenant?.metadata?.ai_settings?.model || "gpt-4o-mini";

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Integraciones</h2>
      </div>
      <p className="text-muted-foreground">Administra las conexiones de tu negocio con otras plataformas.</p>

      {resolvedSearchParams.meli === "connected" && (
        <Alert className="mt-4 border-green-500 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" color="currentColor" />
          <AlertTitle>¡Conexión Exitosa!</AlertTitle>
          <AlertDescription>
            Tu cuenta de Mercado Libre se ha vinculado correctamente.
          </AlertDescription>
        </Alert>
      )}

      {resolvedSearchParams.meli === "error" && (
        <Alert variant="destructive" className="mt-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error de Conexión</AlertTitle>
          <AlertDescription>
            Hubo un problema al vincular tu cuenta de Mercado Libre. Por favor, intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <MeliCard meliAccount={meliAccount} />

        {/* WhatsApp */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">WhatsApp</CardTitle>
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription className="mt-2 mb-4">
              Responde automáticamente a tus clientes usando la API oficial.
            </CardDescription>
            <div className="flex items-center justify-between">
              <StatusBadge variant={waStatus === 'conectado' ? 'success' : 'neutral'} className="capitalize">
                {waStatus}
              </StatusBadge>
              <WhatsAppConfigModal waStatus={waStatus} currentPhoneNumber={waAccount?.phone_number} />
            </div>
          </CardContent>
        </Card>

        {/* OpenAI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">OpenAI</CardTitle>
            <Bot className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription className="mt-2 mb-4">
              Habilita la IA para responder preguntas y consultar tus ventas.
            </CardDescription>
            <div className="flex items-center justify-between">
              <StatusBadge variant={openAIStatus === 'conectado' ? 'success' : 'neutral'} className="capitalize">
                {openAIStatus}
              </StatusBadge>
              {openAIStatus === 'conectado' ? (
                <OpenAIConfigModal currentModel={aiModel} usage={usage?.ai_credits_used || 0} limit={500} />
              ) : (
                <Button variant="outline" size="sm">Conectar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
