import { Sidebar } from "@/components/sidebar/sidebar";
import { Navbar } from "@/components/dashboard/navbar";
import { Footer } from "@/components/layout/footer";
import { createClient } from "@/lib/supabase/server";
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

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
    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        tenant_id,
        tenants:tenants(
          is_demo,
          demo_label,
          subscriptions:subscriptions(plan, expires_at)
        )
      `)
      .eq("id", user.id)
      .single();

    const tenant = (profile as any)?.tenants;
    const isDemo = Boolean(tenant?.is_demo);
    const subscription = tenant?.subscriptions;
    if (subscription) {
      plan = isDemo ? "Demo" : subscription.plan;
      if (subscription.expires_at && !isDemo) {
        const expiresAt = new Date(subscription.expires_at);
        const now = new Date();
        const diffTime = expiresAt.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else if (isDemo) {
      plan = "Demo";
    }

    return (
      <div className={`${archivo.variable} ${archivo.className} flex h-screen overflow-hidden bg-[#F5F3EE] text-[#101828] antialiased selection:bg-[#F2C94C] selection:text-[#101828]`}>
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Navbar plan={plan} daysRemaining={daysRemaining} isDemo={isDemo} />
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

  return (
    <div className={`${archivo.variable} ${archivo.className} flex h-screen overflow-hidden bg-[#F5F3EE] text-[#101828] antialiased selection:bg-[#F2C94C] selection:text-[#101828]`}>
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Navbar plan={plan} daysRemaining={daysRemaining} isDemo={false} />
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
