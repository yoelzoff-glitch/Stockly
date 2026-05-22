import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchCompetitors } from "@/services/competition/searchCompetitors";
import { normalizeCompetitors } from "@/services/competition/normalizeCompetitors";

export async function POST(req: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { product_id } = await req.json();

    if (!product_id) {
      return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.tenant_id) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = profile.tenant_id;

    // 1. Search competitors
    const { query, own_price, competitors } = await searchCompetitors(tenantId, product_id);

    // 2. Normalize and calculate metrics
    const metrics = normalizeCompetitors(own_price, competitors);

    // 3. Save snapshot to DB
    const { data: snapshot, error: insertError } = await supabase
      .from("competition_snapshots")
      .insert({
        tenant_id: tenantId,
        product_id,
        query,
        own_price,
        avg_price: metrics.avg_price,
        min_price: metrics.min_price,
        max_price: metrics.max_price,
        median_price: metrics.median_price,
        competitors_count: metrics.competitors_count,
        free_shipping_count: metrics.free_shipping_count,
        raw_results: competitors,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving competition snapshot:", insertError);
      return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: snapshot });

  } catch (error: any) {
    console.error("Error analyzing competition:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze competition" }, { status: 500 });
  }
}
