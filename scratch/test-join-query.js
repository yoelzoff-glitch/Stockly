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
  // Let's get a profile id
  const { data: profiles } = await supa.from('profiles').select('id, tenant_id').limit(1);
  if (!profiles || profiles.length === 0) {
    console.error("No profiles found");
    return;
  }
  const userId = profiles[0].id;
  console.log("Testing nested joined query for user ID:", userId);

  const { data, error } = await supa
    .from('profiles')
    .select(`
      tenant_id,
      tenants:tenants(id, subscriptions:subscriptions(expires_at))
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error("Nested joined query failed:", error.message, error.details);
  } else {
    console.log("Nested joined query succeeded! Result:", data);
    console.log("Parsed expires_at:", data.tenants?.subscriptions?.[0]?.expires_at);
  }
}

main();
