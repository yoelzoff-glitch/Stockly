const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supa = createClient(supabaseUrl, supabaseKey);

async function main() {
  const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';
  console.log("Tenant ID:", tenantId);

  // Get cancelled orders
  const { data: cancelledOrders, error: ordersError } = await supa
    .from("orders")
    .select("id, meli_order_id, raw_data, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("status", "cancelled");

  if (ordersError) {
    console.error("Error fetching cancelled orders:", ordersError.message);
    return;
  }

  console.log(`Found ${cancelledOrders.length} cancelled orders in orders table.`);

  const orderIds = cancelledOrders.map(o => o.id);
  const { data: existingCancellations } = await supa
    .from("order_cancellations")
    .select("order_id")
    .in("order_id", orderIds);

  const existingOrderIds = new Set((existingCancellations || []).map(c => c.order_id));

  const cancellationsToUpsert = [];

  for (const order of cancelledOrders) {
    if (existingOrderIds.has(order.id)) {
      console.log(`Order #${order.meli_order_id} already has a cancellation record.`);
      continue;
    }

    console.log(`Order #${order.meli_order_id} does NOT have a cancellation record. Preparing to insert...`);
    const raw = order.raw_data || {};
    const cancelDetail = raw.cancel_detail;
    
    const reason = cancelDetail?.description || "Cancelada";
    const cancelledBy = cancelDetail?.requested_by || "Desconocido";
    const refundAmount = raw.total_amount || 0;
    const dateCancelled = cancelDetail?.date || raw.last_updated || new Date().toISOString();

    cancellationsToUpsert.push({
      tenant_id: tenantId,
      order_id: order.id,
      meli_order_id: order.meli_order_id,
      reason: reason,
      cancelled_by: cancelledBy,
      refund_amount: refundAmount,
      date_cancelled: dateCancelled,
      raw_data: cancelDetail || {},
    });
  }

  if (cancellationsToUpsert.length > 0) {
    console.log(`Inserting ${cancellationsToUpsert.length} records into order_cancellations...`);
    const { data, error: insertError } = await supa
      .from("order_cancellations")
      .insert(cancellationsToUpsert)
      .select();

    if (insertError) {
      console.error("Error inserting order cancellations:", insertError.message, insertError.details, insertError.hint);
    } else {
      console.log("Successfully inserted cancellations:", data);
    }
  } else {
    console.log("No new cancellations to insert.");
  }
}

main();
