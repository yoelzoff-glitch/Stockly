import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HealthClientPage from "./client-page";
import { calculateBusinessHealth } from "@/services/health/calculateHealth";

export default async function HealthPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.tenant_id) redirect("/onboarding");

  // Calculate health score dynamically
  const healthData = await calculateBusinessHealth(profile.tenant_id);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Business Health Center</h2>
      </div>
      <p className="text-muted-foreground">
        Analizamos tu negocio en tiempo real para encontrar oportunidades de mejora.
      </p>

      <HealthClientPage healthData={healthData} />
    </div>
  );
}
