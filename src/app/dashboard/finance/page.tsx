import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FinanceClientPage from "./client-page";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { getFinancialData } from "@/services/finance/getFinancialData";

export default async function FinancePage(props: { searchParams: Promise<{ period?: string }> }) {
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

  // Fetch Tenant details first (needed for timezone, packaging cost and ignored orders)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const packagingCost = tenant?.metadata?.packaging_cost ? Number(tenant.metadata.packaging_cost) : 0;
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];

  // Get current date parts in tenant's timezone (prevents UTC rollover issues)
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

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
  } else { // "all"
    dateFrom = new Date(2000, 0, 1);
  }

  const financials = await getFinancialData(
    supabase,
    tenantId,
    dateFrom,
    dateTo,
    packagingCost,
    ignoredOrderIds,
    period === "current_month" || period === "last_month",
    timezone
  );

  let comparisonData = null;

  if (period === "current_month") {
    const prevYear = tenantMonth === 1 ? tenantYear - 1 : tenantYear;
    const prevMonth = tenantMonth === 1 ? 12 : tenantMonth - 1;
    
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    
    let prevMonthDay = tenantDay;
    if (tenantDay >= 30) {
      prevMonthDay = 30;
    }
    prevMonthDay = Math.min(prevMonthDay, daysInPrevMonth);
    
    const prevDateFrom = getMidnightInTimezone(new Date(Date.UTC(prevYear, prevMonth - 1, 1, 12, 0, 0)), timezone);
    
    let prevDateTo: Date;
    if (tenantDay === 31 || tenantDay > daysInPrevMonth) {
      const endOfTargetDay = getMidnightInTimezone(new Date(Date.UTC(prevYear, prevMonth - 1, prevMonthDay, 12, 0, 0)), timezone);
      prevDateTo = new Date(endOfTargetDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else {
      const durationMs = dateTo.getTime() - dateFrom.getTime();
      prevDateTo = new Date(prevDateFrom.getTime() + durationMs);
    }

    try {
      const prevFinancials = await getFinancialData(
        supabase,
        tenantId,
        prevDateFrom,
        prevDateTo,
        packagingCost,
        ignoredOrderIds,
        true, // disable proration to get exact numbers
        timezone
      );
      
      const getMonthName = (m: number) => {
        const names = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        return names[m - 1] || "";
      };
      
      comparisonData = {
        label: `respecto al ${prevMonthDay} de ${getMonthName(prevMonth)}`,
        prevFacturacionBruta: prevFinancials.facturacionBruta,
        prevGananciaNeta: prevFinancials.gananciaNeta,
        prevCancellationsAmount: prevFinancials.cancellationsAmount
      };
    } catch (e) {
      console.error("Failed to fetch comparison financials:", e);
    }
  }

  return (
    <div className="flex-1 p-8 pt-6">
      <FinanceClientPage 
        financials={financials}
        currentPeriod={period}
        comparisonData={comparisonData}
      />
    </div>
  );
}
