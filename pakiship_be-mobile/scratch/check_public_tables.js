const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const publicTablesToCheck = [
  'profiles',
  'parcel_drafts',
  'parcel_draft_items',
  'drop_off_points',
  'driver_jobs',
  'notifications',
  'activity_logs',
  'users',
  'partner_hubs',
  'parcel_hub_records'
];

async function checkPublicSchema() {
  console.log('=== Checking Tables in Public Schema ===');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  for (const table of publicTablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table) // Defaults to public schema
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[Table: public.${table}] -> ❌ NOT PRESENT or ERROR`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Code: ${error.code}\n`);
      } else {
        console.log(`[Table: public.${table}] -> LIVES/ACTIVE ✅`);
        console.log(`  Records retrieved: ${data.length}\n`);
      }
    } catch (e) {
      console.log(`[Table: public.${table}] -> ❌ EXCEPTION: ${e.message}\n`);
    }
  }
}

checkPublicSchema();
