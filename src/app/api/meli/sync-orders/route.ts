import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncOrders } from "@/services/meli/syncOrders";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Validate auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get profile and tenant_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }

    // 3. Sync orders
    const syncedCount = await syncOrders(profile.tenant_id);

    return NextResponse.json({ success: true, syncedCount });
  } catch (error: any) {
    console.error("Error syncing orders API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync orders" }, 
      { status: 500 }
    );
  }
}
