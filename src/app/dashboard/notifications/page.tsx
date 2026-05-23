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
    <div className="flex-1 p-8 pt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Centro de Notificaciones</h2>
          <p className="text-muted-foreground mt-1">Historial completo de alertas y eventos del sistema.</p>
        </div>
      </div>
      <NotificationsClientPage initialAlerts={alerts || []} />
    </div>
  );
}
