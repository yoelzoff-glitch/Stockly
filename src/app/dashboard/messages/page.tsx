import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/dashboard/chat-interface";

export default async function MessagesPage({ searchParams }: { searchParams: { msg?: string } }) {
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
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] p-0 md:p-8 md:pt-6">
      <div className="hidden md:flex items-center justify-between space-y-2 mb-4">
        <h2 className="text-3xl font-bold tracking-tight">Asistente Stockly</h2>
      </div>
      <p className="hidden md:block text-muted-foreground mb-6">Pregúntale a nuestra Inteligencia Artificial sobre tus ventas, stock y productos usando lenguaje natural.</p>
      
      <div className="flex-1 overflow-hidden border-0 md:border md:rounded-xl shadow-none md:shadow-sm bg-background flex flex-col">
        <ChatInterface initialMessages={initialMessages as any} initialPrompt={searchParams?.msg} />
      </div>
    </div>
  );
}
