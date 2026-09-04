import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsClientPage from "./client-page";

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

  // Initial fetch of alerts
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <NotificationsClientPage initialAlerts={alerts || []} tenantId={profile.tenant_id} />
  );
}
