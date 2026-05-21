const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const targets = [
  { schema: 'account', table: 'profiles' },
  { schema: 'auth', table: 'profiles' },
  { schema: 'parcel', table: 'parcel_drafts' },
  { schema: 'driver', table: 'driver_jobs' }
];

async function verify() {
  console.log('=== VERIFYING DATABASE ACCESS LOCKDOWN ===\n');

  console.log('--- 1. Testing BACKEND (service_role) Access ---');
  for (const target of targets) {
    try {
      const { data, error } = await serviceClient
        .schema(target.schema)
        .from(target.table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[service_role] schema: ${target.schema}, table: ${target.table} -> ❌ BLOCKED/ERROR: ${error.message}`);
      } else {
        console.log(`[service_role] schema: ${target.schema}, table: ${target.table} -> LIVES/ACTIVE ✅ (Rows: ${data.length})`);
      }
    } catch (e) {
      console.log(`[service_role] schema: ${target.schema}, table: ${target.table} -> ❌ EXCEPTION: ${e.message}`);
    }
  }

  console.log('\n--- 2. Testing FRONTEND (anon) Lockout ---');
  for (const target of targets) {
    try {
      const { data, error } = await anonClient
        .schema(target.schema)
        .from(target.table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[anon] schema: ${target.schema}, table: ${target.table} -> BLOCKED AS EXPECTED ✅ (Error: ${error.message})`);
      } else {
        console.log(`[anon] schema: ${target.schema}, table: ${target.table} -> ⚠️ LEAKED/ACCESSIBLE! (Rows: ${data.length})`);
      }
    } catch (e) {
      console.log(`[anon] schema: ${target.schema}, table: ${target.table} -> BLOCKED AS EXPECTED ✅ (Exception: ${e.message})`);
    }
  }
}

verify();
