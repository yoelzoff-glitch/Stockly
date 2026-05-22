import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompetitionClient } from "./client-page";

export default async function CompetitionPage() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) {
    return <div>No se encontró la cuenta.</div>;
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, status, category_id")
    .eq("tenant_id", profile.tenant_id)
    .order("available_quantity", { ascending: false });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Competencia</h2>
      </div>
      <p className="text-muted-foreground">
        Compara tus productos con otras publicaciones similares en Mercado Libre para detectar oportunidades de precio.
      </p>

      <CompetitionClient products={products || []} />
    </div>
  );
}
