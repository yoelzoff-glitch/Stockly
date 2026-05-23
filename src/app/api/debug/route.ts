import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('messages').select('*').limit(1);
  return NextResponse.json({
    has_product_id: data && data.length > 0 ? ('product_id' in data[0]) : false,
    columns: data && data.length > 0 ? Object.keys(data[0]) : []
  });
}
