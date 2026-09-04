// src/app/dashboard/accounting/page.tsx
import { getMonthlyExpenses, MonthlyExpense } from "./actions";
import { AccountingClient } from "./client-page";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { getFinancialData } from "@/services/finance/getFinancialData";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contabilidad - Klyvo",
  description: "Administra tus gastos fijos, temporales y variables para calcular tu rentabilidad real limpia."
};

export default async function AccountingPage(props: { searchParams: Promise<{ month?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) redirect("/onboarding");

  const tenantId = profile.tenant_id;

  // Fetch Tenant details first (needed for timezone, packaging cost and ignored orders)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const packagingCost = tenant?.metadata?.packaging_cost ? Number(tenant.metadata.packaging_cost) : 0;
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];

  // Get current date parts in tenant's timezone
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth] = tenantDateStr.split('-').map(Number);

  // Determine selected month (e.g. "2026-07")
  const defaultMonthStr = `${tenantYear}-${String(tenantMonth).padStart(2, '0')}`;
  const selectedMonthStr = searchParams.month || defaultMonthStr;

  const [year, month] = selectedMonthStr.split('-').map(Number);

  // Calculate start of selected month
  const dateFrom = getMidnightInTimezone(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)), timezone);

  // Calculate end of selected month
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = getMidnightInTimezone(new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1, 12, 0, 0)), timezone);
  const dateTo = new Date(nextMonthStart.getTime() - 1);

  let initialExpenses: MonthlyExpense[] = [];
  let actualRevenue = 0;
  let actualOperatingProfit = 0;

  try {
    initialExpenses = await getMonthlyExpenses();

    const financials = await getFinancialData(
      supabase,
      tenantId,
      dateFrom,
      dateTo,
      packagingCost,
      ignoredOrderIds,
      true, // disableProration = true (full month calculation)
      timezone
    );
    actualRevenue = financials.facturacionBruta;
    actualOperatingProfit = financials.gananciaNeta;
  } catch (e) {
    console.error("Failed to load monthly expenses or finance data:", e);
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <AccountingClient
        initialExpenses={initialExpenses}
        actualRevenue={actualRevenue}
        actualOperatingProfit={actualOperatingProfit}
        currentMonthStr={selectedMonthStr}
      />
    </div>
  );
}
