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
import { OperationalPageHeader } from "@/components/operational/page-header";

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
  const { data: tenant } = await supabase.from("tenants").select("metadata, is_demo, demo_label").eq("id", tenantId).maybeSingle();
  const isDemo = Boolean(tenant?.is_demo);
  const { data: usage } = await supabase.from("subscription_usage").select("ai_credits_used").eq("tenant_id", tenantId).maybeSingle();
  const aiModel = tenant?.metadata?.ai_settings?.model || "gpt-4o-mini";

  const displayWaStatus = isDemo ? "Simulación demo" : waStatus;
  const displayAIStatus = isDemo ? "Simulación demo" : openAIStatus;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Integraciones y Canales"
        description="Estado operativo y credenciales de conexión con Mercado Libre, WhatsApp y proveedores externos."
      />

      {resolvedSearchParams.meli === "connected" && (
        <div className="p-3.5 rounded-lg border border-[#A6F4C5] bg-[#ECFDF3] text-xs text-[#027A48] flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#12B76A]" />
          <span>Tu cuenta de Mercado Libre se ha vinculado correctamente.</span>
        </div>
      )}

      {resolvedSearchParams.meli === "error" && (
        <div className="p-3.5 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] text-xs text-[#B42318] flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0 text-[#D92D20]" />
          <span>Hubo un problema al vincular tu cuenta de Mercado Libre. Por favor, intenta de nuevo.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MeliCard meliAccount={meliAccount} isDemo={isDemo} />

        {/* WhatsApp */}
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-5 flex flex-col justify-between h-full space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCDAD4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#15803D]">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#101828]">WhatsApp Cloud API</h3>
                  <p className="text-[11px] text-[#5F6875]">Canal de Comunicación</p>
                </div>
              </div>
              <StatusBadge variant={isDemo ? "neutral" : (waStatus === "conectado" ? "success" : "neutral")} className="capitalize">
                {displayWaStatus}
              </StatusBadge>
            </div>

            <p className="text-xs text-[#5F6875] leading-relaxed">
              Notificaciones automáticas a compradores y recepción de consultas a través de la API oficial de Meta.
            </p>

            {waAccount?.phone_number && (
              <div className="space-y-1.5 pt-2 border-t border-[#DCDAD4] text-xs font-mono text-[#5F6875]">
                <div className="flex justify-between items-center">
                  <span>Número configurado:</span>
                  <span className="text-[#101828] font-semibold">{waAccount.phone_number}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#DCDAD4] mt-auto">
            <WhatsAppConfigModal waStatus={waStatus} currentPhoneNumber={waAccount?.phone_number} />
          </div>
        </div>

        {/* OpenAI */}
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-5 flex flex-col justify-between h-full space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCDAD4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center text-[#101828]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#101828]">Motor de Procesamiento</h3>
                  <p className="text-[11px] text-[#5F6875]">OpenAI GPT / Modelos LLM</p>
                </div>
              </div>
              <StatusBadge variant={isDemo ? "neutral" : (openAIStatus === "conectado" ? "success" : "neutral")} className="capitalize">
                {displayAIStatus}
              </StatusBadge>
            </div>

            <p className="text-xs text-[#5F6875] leading-relaxed">
              Capacidades de análisis de preguntas frecuentes, asistencia en respuestas y categorización operativa.
            </p>

            <div className="space-y-1.5 pt-2 border-t border-[#DCDAD4] text-xs font-mono text-[#5F6875]">
              <div className="flex justify-between items-center">
                <span>Modelo activo:</span>
                <span className="text-[#101828] font-semibold">{aiModel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Consumo mensual:</span>
                <span className="text-[#101828]">{usage?.ai_credits_used || 0} / 500 créditos</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#DCDAD4] mt-auto">
            {openAIStatus === "conectado" ? (
              <OpenAIConfigModal currentModel={aiModel} usage={usage?.ai_credits_used || 0} limit={500} />
            ) : (
              <Button variant="outline" size="sm" className="w-full h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]">
                Configurar API Key
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
