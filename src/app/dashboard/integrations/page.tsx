import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle, Bot } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

import { MeliCard } from "@/components/dashboard/meli-card";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { meli?: string };
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Check Mercado Libre
  const { count: meliCount } = await supabase
    .from("meli_accounts")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // Check WhatsApp
  const { count: waCount } = await supabase
    .from("whatsapp_numbers")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const meliStatus = meliCount && meliCount > 0 ? "conectado" : "pendiente";
  
  let waStatus = "pendiente";
  if (waCount && waCount > 0) {
    waStatus = "conectado";
  } else if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    waStatus = "conectado"; // Local dev fallback
  }
  
  // OpenAI relies on env var for now
  const openAIStatus = process.env.OPENAI_API_KEY ? "conectado" : "pendiente";

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Integraciones</h2>
      </div>
      <p className="text-muted-foreground">Administra las conexiones de tu negocio con otras plataformas.</p>

      {searchParams.meli === "connected" && (
        <Alert className="mt-4 border-green-500 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" color="currentColor" />
          <AlertTitle>¡Conexión Exitosa!</AlertTitle>
          <AlertDescription>
            Tu cuenta de Mercado Libre se ha vinculado correctamente.
          </AlertDescription>
        </Alert>
      )}

      {searchParams.meli === "error" && (
        <Alert variant="destructive" className="mt-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error de Conexión</AlertTitle>
          <AlertDescription>
            Hubo un problema al vincular tu cuenta de Mercado Libre. Por favor, intenta de nuevo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <MeliCard status={meliStatus as any} />

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
              <Badge variant={waStatus === 'conectado' ? 'default' : 'secondary'} className="capitalize">
                {waStatus}
              </Badge>
              <Button variant="outline" size="sm" disabled={waStatus === 'conectado'}>
                {waStatus === 'conectado' ? 'Configurar' : 'Conectar'}
              </Button>
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
              <Badge variant={openAIStatus === 'conectado' ? 'default' : 'secondary'} className="capitalize">
                {openAIStatus}
              </Badge>
              <Button variant="outline" size="sm" disabled={openAIStatus === 'conectado'}>
                {openAIStatus === 'conectado' ? 'Configurar' : 'Conectar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
