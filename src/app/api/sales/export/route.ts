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

    const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
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

    if (search.trim()) {
      query = query.or(`meli_order_id.ilike.%${search.trim()}%,buyer_nickname.ilike.%${search.trim()}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Error fetching sales data" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // Convert orders to CSV
    const headers = [
      "ID Venta",
      "Fecha",
      "Estado",
      "Comprador",
      "Total Venta",
      "Costo de Envio",
      "Comision ML",
      "Ganancia Estimada",
      "Metodo de Envio"
    ];

    const rows = (orders || []).map((order) => {
      return [
        `"${order.meli_order_id || order.id}"`,
        `"${new Date(order.date_created).toLocaleDateString('es-AR')}"`,
        `"${order.status}"`,
        `"${order.buyer_nickname || 'Consumidor Final'}"`,
        `"${order.total_amount || 0}"`,
        `"${order.shipping_cost_owner || 0}"`,
        `"${order.marketplace_fee || 0}"`,
        `"${order.profit_estimated || 0}"`,
        `"${order.shipping_type || 'Estándar'}"`
      ].join(";");
    });

    const csvContent = [headers.join(";"), ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ventas_stockly_${new Date().toISOString().split('T')[0]}.csv"`,
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}
