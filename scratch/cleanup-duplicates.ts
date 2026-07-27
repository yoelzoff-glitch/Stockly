import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const idsToDelete = [
    'f481604e-4ee3-4514-9e45-7e35deb4489b',
    '9107dc24-de40-4c28-bafc-3d8c8122e50c',
    '2241c7da-d911-49ce-90af-4a680e06b04b'
  ];

  console.log("Deleting duplicate order item IDs:", idsToDelete);
  const { data, error } = await supa
    .from("order_items")
    .delete()
    .in("id", idsToDelete)
    .select("id, order_id, title");

  if (error) {
    console.error("Error deleting duplicates:", error);
  } else {
    console.log("Successfully deleted:", data);
  }
}

main().catch(console.error);
