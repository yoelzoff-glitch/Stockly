import { Sidebar } from "@/components/sidebar/sidebar";
import { Navbar } from "@/components/dashboard/navbar";
import { Footer } from "@/components/layout/footer";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan = "starter";
  let daysRemaining = null;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (profile?.tenant_id) {
      const { data: subscription } = await supabase.from("subscriptions").select("*").eq("tenant_id", profile.tenant_id).single();
      if (subscription) {
        plan = subscription.plan;
        if (subscription.expires_at) {
          const expiresAt = new Date(subscription.expires_at);
          const now = new Date();
          const diffTime = expiresAt.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Navbar plan={plan} daysRemaining={daysRemaining} />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
