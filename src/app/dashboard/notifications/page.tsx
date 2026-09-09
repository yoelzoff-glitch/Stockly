import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsClientPage from "./client-page";

export const metadata = {
  title: "Actividad y alertas - LibretaX",
  description: "Centro de alertas operativas y registro de actividad de tu negocio.",
};

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) redirect("/onboarding");

  // Initial fetch of alerts excluding archived summaries
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .neq("status", "archived")
    .not("title", "like", "Resumen Diario%")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <NotificationsClientPage initialAlerts={alerts || []} tenantId={profile.tenant_id} />
  );
}
