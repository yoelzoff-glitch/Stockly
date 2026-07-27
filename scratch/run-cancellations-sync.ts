import { syncCancellations } from "../src/services/meli/syncCancellations";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: tenants } = await supa.from("tenants").select("id, name");
  console.log("Tenants:", tenants);

  const tId = tenants?.[0]?.id;
  if (!tId) return;
  console.log("Running syncCancellations for tenant:", tId);

  const result = await syncCancellations(tId);
  console.log("Sync Cancellations result:", result);
}

main().catch(console.error);
