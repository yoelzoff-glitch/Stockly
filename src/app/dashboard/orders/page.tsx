import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrdersClient } from "./client-page";

export default async function OrdersPage() {
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

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", session.user.id)
    .single();

  if (!tenantUser) redirect("/onboarding");

  // Fetch orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantUser.tenant_id)
    .order("date_created", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching orders:", error);
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Ventas</h2>
      </div>
      <p className="text-muted-foreground">
        Administra tus ventas recientes y visualiza el estado de las órdenes.
      </p>

      <OrdersClient initialOrders={orders || []} />
    </div>
  );
}
