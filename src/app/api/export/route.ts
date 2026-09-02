import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as xlsx from "xlsx";
import * as Sentry from "@sentry/nextjs";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";

export async function GET(req: Request) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(req);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    const supabase = createAdminClient();

    // Fetch Products strictly scoped to tenant
    const { data: products } = await supabase
      .from("products")
      .select("sku, title, price, cost, available_quantity, status")
      .eq("tenant_id", tenantId);

    // Fetch Orders strictly scoped to tenant
    const { data: orders } = await supabase
      .from("orders")
      .select("meli_order_id, status, total_amount, date_created, buyer_name")
      .eq("tenant_id", tenantId)
      .order("date_created", { ascending: false })
      .limit(500);

    // Create Workbook
    const wb = xlsx.utils.book_new();

    // Add Products Sheet
    const wsProducts = xlsx.utils.json_to_sheet(products || []);
    xlsx.utils.book_append_sheet(wb, wsProducts, "Productos y Stock");

    // Add Orders/Sales Sheet
    const wsOrders = xlsx.utils.json_to_sheet(orders || []);
    xlsx.utils.book_append_sheet(wb, wsOrders, "Órdenes y Ventas");

    // Generate buffer
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="klyvo_backup.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });

  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "EXPORT_BACKUP", correlationId } });
    return toAuthErrorResponse(error, correlationId);
  }
}
