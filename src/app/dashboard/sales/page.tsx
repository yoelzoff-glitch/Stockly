import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SalesClientPage from "./client-page";

export default async function SalesPage() {
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

  // Fetch orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("date_created", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching orders:", error);
  }

  return (
    <div className="flex-1 p-8 pt-6">

      <SalesClientPage initialOrders={orders || []} />
    </div>
  );
}
