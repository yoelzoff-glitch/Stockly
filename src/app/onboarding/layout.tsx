import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PaymentPendingScreen from "./payment-pending";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const selectedPlan = user.user_metadata?.plan || "starter";
  const paymentStatus = user.user_metadata?.payment_status || "paid";

  if ((selectedPlan === 'pro' || selectedPlan === 'ultra') && paymentStatus !== 'paid') {
    return <PaymentPendingScreen plan={selectedPlan} />;
  }

  return <>{children}</>;
}
