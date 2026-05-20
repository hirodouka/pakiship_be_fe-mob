const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const schemasToCheck = [
  { schema: 'account', table: 'profiles' },
  { schema: 'parcel', table: 'drop_off_points' },
  { schema: 'driver', table: 'driver_jobs' },
  { schema: 'notifications', table: 'notifications' },
  { schema: 'partner', table: 'partner_hubs' },
  { schema: 'public', table: 'users' }
];

async function inspectSchemas() {
  console.log('=== Checking with Anon Key ===');
  for (const item of schemasToCheck) {
    try {
      const { data, error } = await supabase
        .schema(item.schema)
        .from(item.table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[Schema: ${item.schema}] Table: ${item.table} -> ❌ ERROR`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Code: ${error.code}\n`);
      } else {
        console.log(`[Schema: ${item.schema}] Table: ${item.table} -> LIVES/ACTIVE ✅`);
        console.log(`  Records: ${data.length}\n`);
      }
    } catch (e) {
      console.log(`[Schema: ${item.schema}] Table: ${item.table} -> ❌ EXCEPTION: ${e.message}\n`);
    }
  }
}

inspectSchemas();
