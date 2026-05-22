import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, MessageCircle, Bot } from "lucide-react";

export default async function IntegrationsPage() {
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
  const waStatus = waCount && waCount > 0 ? "conectado" : "pendiente";
  
  // OpenAI relies on env var for now
  const openAIStatus = process.env.OPENAI_API_KEY ? "conectado" : "pendiente";

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Integraciones</h2>
      </div>
      <p className="text-muted-foreground">Administra las conexiones de tu negocio con otras plataformas.</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {/* Mercado Libre */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Mercado Libre</CardTitle>
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription className="mt-2 mb-4">
              Sincroniza tus publicaciones, stock y ventas de Mercado Libre.
            </CardDescription>
            <div className="flex items-center justify-between">
              <Badge variant={meliStatus === 'conectado' ? 'default' : 'secondary'} className="capitalize">
                {meliStatus}
              </Badge>
              <Button variant="outline" size="sm" disabled={meliStatus === 'conectado'}>
                {meliStatus === 'conectado' ? 'Configurar' : 'Conectar'}
              </Button>
            </div>
          </CardContent>
        </Card>

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
