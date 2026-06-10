import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30");
  const statusFilter = searchParams.get("status") || "all";
  const search = searchParams.get("search") || "";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", session.user.id)
    .single();

  if (!profile?.tenant_id) {
    return new NextResponse("Tenant not found", { status: 404 });
  }

  let query = supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("date_created", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: orders, error } = await query;

  if (error || !orders) {
    return new NextResponse("Error fetching orders", { status: 500 });
  }

  // Filter by date and search in memory (since date math in supabase JS can be tricky)
  const today = new Date();
  const filteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.date_created);
    const diffDays = Math.ceil((today.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));
    const matchesDate = diffDays <= days;

    const matchesSearch = !search || 
                          o.buyer_nickname?.toLowerCase().includes(search.toLowerCase()) || 
                          o.meli_order_id?.toLowerCase().includes(search.toLowerCase()) ||
                          o.product_title?.toLowerCase().includes(search.toLowerCase());

    return matchesDate && matchesSearch;
  });

  // Generate CSV
  const headers = ["Fecha", "Nº Orden", "Comprador", "Producto", "Cantidad", "Total (ARS)", "Estado"];
  
  const csvRows = [];
  csvRows.push(headers.join(","));

  for (const o of filteredOrders) {
    const date = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(o.date_created));
    // Escape quotes and commas
    const raw = o.raw_data as any;
    const titleVal = raw?.order_items?.[0]?.item?.title || o.product_title || "Varios productos";
    const title = `"${titleVal.replace(/"/g, '""')}"`;
    const buyer = `"${(o.buyer_nickname || "").replace(/"/g, '""')}"`;
    const quantity = raw?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0) || 1;
    
    const row = [
      date,
      o.meli_order_id,
      buyer,
      title,
      quantity,
      o.total_amount,
      o.status
    ];
    csvRows.push(row.join(","));
  }

  const csvContent = csvRows.join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="klyvo_ventas_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
