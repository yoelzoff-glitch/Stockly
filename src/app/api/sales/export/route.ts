import { NextRequest, NextResponse } from "next/server";
import { getPeriodRangeInTimezone } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function GET(request: NextRequest) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(request);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

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

    let query = supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("date_created", dateFrom.toISOString())
      .lte("date_created", dateTo.toISOString())
      .order("date_created", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: orders, error } = await query;

    if (error || !orders) {
      return NextResponse.json(
        { error: "Error fetching sales data" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Safe in-memory search filtering (preserves 58211d3 behavior without SQL/PostgREST injection risk)
    const filteredOrders = orders.filter((o) => {
      const matchesSearch =
        !search ||
        o.buyer_nickname?.toLowerCase().includes(search.toLowerCase()) ||
        o.meli_order_id?.toLowerCase().includes(search.toLowerCase()) ||
        o.product_title?.toLowerCase().includes(search.toLowerCase());

      return matchesSearch;
    });

    // Generate CSV exact format from 58211d3
    const headers = ["Fecha", "Nº Orden", "Comprador", "Producto", "Cantidad", "Total (ARS)", "Estado"];
    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const o of filteredOrders) {
      const date = new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(o.date_created));

      const raw = o.raw_data as any;
      const titleVal = raw?.order_items?.[0]?.item?.title || o.product_title || "Varios productos";
      const title = `"${String(titleVal).replace(/"/g, '""')}"`;
      const buyer = `"${(o.buyer_nickname || "").replace(/"/g, '""')}"`;
      const quantity = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0) || 1;

      const row = [
        date,
        o.meli_order_id,
        buyer,
        title,
        quantity,
        o.total_amount,
        o.status,
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

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
