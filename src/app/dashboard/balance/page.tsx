import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getBalanceData } from "@/services/balance/getBalanceData";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { getPeriodRangeInTimezone } from "@/lib/dates";
import BalanceClientPage from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Balance después de Compras - LibretaX",
  description: "Conecta los resultados de ventas y finanzas con las compras registradas de mercadería.",
};

export default async function BalancePage(props: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}) {
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
  const period = searchParams.period || "current_month";

  // Fetch Tenant details for timezone, packaging cost and ignored orders
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", tenantId)
    .single();

  const timezone = tenant?.timezone || "America/Argentina/Buenos_Aires";
  const packagingCost = tenant?.metadata?.packaging_cost ? Number(tenant.metadata.packaging_cost) : 0;
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];

  // Get current date parts in tenant's timezone (identical criteria to Finance)
  const tenantDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split("-").map(Number);

  let dateFrom: Date;
  let dateTo = new Date(); // now

  if (period === "current_month") {
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  } else if (period === "last_month") {
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 2, 1, 12, 0, 0)), timezone);
    const startOfCurrentMonth = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
    dateTo = new Date(startOfCurrentMonth.getTime() - 1);
  } else if (period === "last_30") {
    const tempDate = new Date(tenantYear, tenantMonth - 1, tenantDay, 12, 0, 0);
    tempDate.setDate(tempDate.getDate() - 30);
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 12, 0, 0)), timezone);
  } else if (period === "custom") {
    const customRange = getPeriodRangeInTimezone("custom", timezone, searchParams.from, searchParams.to);
    dateFrom = customRange.dateFrom;
    dateTo = customRange.dateTo;
  } else {
    // Fallback to current month
    dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  }

  const disableProration = period === "current_month" || period === "last_month";

  let balanceData = null;
  let loadError: string | null = null;

  try {
    balanceData = await getBalanceData({
      supabase,
      tenantId,
      dateFrom,
      dateTo,
      packagingCost,
      ignoredOrderIds,
      disableProration,
      timezone
    });
  } catch (err: any) {
    console.error("Failed to load balance data:", err);
    loadError = err.message || "Error al consultar los datos del balance.";
  }

  return (
    <div className="flex-1 p-8 pt-6">
      <BalanceClientPage
        initialData={balanceData}
        currentPeriod={period}
        fromParam={searchParams.from || ""}
        toParam={searchParams.to || ""}
        errorMessage={loadError}
      />
    </div>
  );
}
