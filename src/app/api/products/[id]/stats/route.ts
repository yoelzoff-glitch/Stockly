import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { meliFetch } from "@/services/meli/client";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "No se encontró inquilino" }, { status: 403 });
    }

    // 1. Fetch the product details
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // 2. Fetch real visits from Mercado Libre if meli_item_id is available
    let meliVisitsData = null;
    if (product.meli_item_id) {
      try {
        meliVisitsData = await meliFetch({
          tenantId: profile.tenant_id,
          endpoint: `/items/${product.meli_item_id}/visits/time_window?last=7&unit=day`
        });
      } catch (err: any) {
        console.error(`Error fetching ML visits for ${product.meli_item_id}:`, err.message);
      }
    }

    // 3. Fetch real daily sales for the last 7 days from Supabase order_items
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        quantity,
        orders (
          date_created
        )
      `)
      .eq("product_id", id)
      .eq("tenant_id", profile.tenant_id);

    // Group real sales by day of week
    const salesByDay: Record<string, number> = {};
    if (!itemsError && orderItems) {
      orderItems.forEach((item: any) => {
        if (!item.orders?.date_created) return;
        const orderDate = new Date(item.orders.date_created);
        if (orderDate >= sevenDaysAgo) {
          const dateStr = orderDate.toISOString().split("T")[0];
          salesByDay[dateStr] = (salesByDay[dateStr] || 0) + (item.quantity || 0);
        }
      });
    }

    // 4. Map visits and sales into the last 7 days structure
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const today = new Date();
    const chartData = [];
    let totalVisits = 0;
    let totalSales = 0;

    // Process Mercado Libre visits mapping
    const visitsByDay: Record<string, number> = {};
    if (meliVisitsData && meliVisitsData.results) {
      meliVisitsData.results.forEach((v: any) => {
        const dateStr = new Date(v.date).toISOString().split("T")[0];
        visitsByDay[dateStr] = v.quantity || 0;
      });
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = days[d.getDay()];

      const dayVisits = visitsByDay[dateStr] !== undefined 
        ? visitsByDay[dateStr] 
        : 0; 
      const daySales = salesByDay[dateStr] || 0;

      totalVisits += dayVisits;
      totalSales += daySales;

      chartData.push({
        name: dayName,
        Visitas: dayVisits,
        Ventas: daySales
      });
    }

    // 5. Calculate real conversion rate
    const conversionRate = totalVisits > 0 
      ? ((totalSales / totalVisits) * 100).toFixed(2) 
      : "0.00";

    return NextResponse.json({
      success: true,
      totalVisits,
      totalSales,
      conversionRate,
      chartData
    });
  } catch (error: any) {
    console.error("Error in product stats route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
