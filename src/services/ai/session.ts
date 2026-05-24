import { createAdminClient } from "@/lib/supabase/admin";

export interface SessionState {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  channel: string;
  phone_number?: string | null;
  status: string;
  current_workflow_id?: string | null;
  current_action_id?: string | null;
  current_action_type?: string | null;
  missing_fields: string[];
  context: any;
  last_activity_at: string;
}

export async function getActiveSession({
  tenantId,
  channel,
  fromPhone,
  userId
}: {
  tenantId: string;
  channel: string;
  fromPhone?: string;
  userId?: string;
}): Promise<SessionState | null> {
  const supabase = createAdminClient();
  
  // Expirar sesiones de hace más de 30 minutos
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000).toISOString();
  
  let query = supabase
    .from("conversation_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("status", "active")
    .gte("last_activity_at", thirtyMinutesAgo)
    .order("last_activity_at", { ascending: false })
    .limit(1);

  if (channel === 'whatsapp' && fromPhone) {
    query = query.eq("phone_number", fromPhone);
  } else if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  return data as SessionState;
}

export async function createSession({
  tenantId,
  channel,
  fromPhone,
  userId
}: {
  tenantId: string;
  channel: string;
  fromPhone?: string;
  userId?: string;
}): Promise<SessionState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("conversation_sessions").insert({
    tenant_id: tenantId,
    channel,
    phone_number: fromPhone,
    user_id: userId,
    status: 'active',
    last_activity_at: new Date().toISOString()
  }).select("*").single();

  if (error) return null;
  return data as SessionState;
}

export async function updateSessionState(
  sessionId: string, 
  updates: { 
    current_workflow_id?: string | null, 
    current_action_id?: string | null,
    current_action_type?: string | null,
    missing_fields?: string[],
    context?: any 
  }
) {
  const supabase = createAdminClient();
  const payload: any = { last_activity_at: new Date().toISOString() };
  if (updates.current_workflow_id !== undefined) payload.current_workflow_id = updates.current_workflow_id;
  if (updates.current_action_id !== undefined) payload.current_action_id = updates.current_action_id;
  if (updates.current_action_type !== undefined) payload.current_action_type = updates.current_action_type;
  if (updates.missing_fields !== undefined) payload.missing_fields = updates.missing_fields;
  if (updates.context !== undefined) payload.context = updates.context;

  await supabase.from("conversation_sessions").update(payload).eq("id", sessionId);
}

export async function clearSessionState(sessionId: string) {
  const supabase = createAdminClient();
  await supabase.from("conversation_sessions").update({
    status: 'completed',
    last_activity_at: new Date().toISOString()
  }).eq("id", sessionId);
}
