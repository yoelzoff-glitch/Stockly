import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { OperationalPageHeader } from "@/components/operational/page-header";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
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

  // Fetch previous messages for this tenant (only web chat where from_phone is null)
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("from_phone", null)
    .order("created_at", { ascending: true });

  const initialMessages = messages?.map(m => ({
    id: m.id,
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.text,
  })) || [];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] p-4 md:p-8 space-y-4">
      <OperationalPageHeader
        title="Consultas Operativas y Mensajes"
        description="Canal de asistencia y consulta rápida sobre inventario, ventas recientes y márgenes por producto."
        className="hidden md:block pb-0"
      />

      <div className="flex-1 overflow-hidden rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] shadow-sm flex flex-col">
        <ChatInterface initialMessages={initialMessages as any} initialPrompt={resolvedSearchParams?.msg} />
      </div>
    </div>
  );
}
