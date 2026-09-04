import { NextRequest, NextResponse } from "next/server";
import { getPeriodRangeInTimezone } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { serializeSalesExportCsv } from "@/lib/export/salesCsvSerializer";
import { checkRateLimit } from "@/lib/security/rateLimiter";

const MAX_EXPORT_ROWS = 25000;
const BATCH_SIZE = 1000;

export async function GET(request: NextRequest) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(request);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    // Distributed Rate Limit check (shadow mode unless api_rate_limits_v2 active)
    const rateLimit = await checkRateLimit(tenantId, "sales_export");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Export limit exceeded. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            [CORRELATION_ID_HEADER]: correlationId || "",
          },
        }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get("days") || "30";
    const statusFilter = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const supabase = createAdminClient();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .maybeSingle();

    const timezone = tenant?.timezone || "America/Argentina/Buenos_Aires";
    const { dateFrom, dateTo } = getPeriodRangeInTimezone(daysParam, timezone, fromParam || undefined, toParam || undefined);

    // Explicit columns selection (eliminates select("*"))
    const selectColumns = "id, meli_order_id, date_created, total_amount, status, raw_data";

    let allOrders: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allOrders.length < MAX_EXPORT_ROWS) {
      let query = supabase
        .from("orders")
        .select(selectColumns)
        .eq("tenant_id", tenantId)
        .gte("date_created", dateFrom.toISOString())
        .lte("date_created", dateTo.toISOString())
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: batch, error } = await query;

      if (error) {
        return NextResponse.json(
          { error: "Error fetching sales data" },
          { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
        );
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allOrders = allOrders.concat(batch);
        offset += batch.length;
        if (batch.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    const csvContent = serializeSalesExportCsv(allOrders, search);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="klyvo_ventas_${new Date().toISOString().split("T")[0]}.csv"`,
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}
