import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SettingsClientPage from "./client-page";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Fetch Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.tenant_id) redirect("/onboarding");

  // Fetch Tenant (Business)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();

  // Fetch ML Account (safe columns only)
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("id, tenant_id, status, token_expires_at, sync_error, last_success_refresh, seller_id, nickname")
    .eq("tenant_id", profile.tenant_id)
    .single();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
      </div>
      <p className="text-muted-foreground">
        Administra la configuración de tu cuenta, tu negocio y las integraciones.
      </p>

      <SettingsClientPage 
        profile={profile} 
        tenant={tenant} 
        meliAccount={meliAccount} 
      />
    </div>
  );
}
