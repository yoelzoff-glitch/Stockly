import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as xlsx from "xlsx";
import * as Sentry from "@sentry/nextjs";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) return new NextResponse("No tenant", { status: 403 });
    const tenantId = profile.tenant_id;

    // Fetch Products
    const { data: products } = await supabase
      .from("products")
      .select("sku, title, price, cost, available_quantity, status")
      .eq("tenant_id", tenantId);

    // Fetch Orders
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
      },
    });

  } catch (error) {
    Sentry.captureException(error, { extra: { context: "EXPORT_BACKUP" } });
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
