const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const locationTables = [
  'drop_off_points',
  'parcel_hub_records'
];

async function checkLocationSchema() {
  console.log('=== Checking Location Schema ===');
  for (const table of locationTables) {
    try {
      const { data, error } = await supabase
        .schema('location')
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[Schema: location] Table: ${table} -> ❌ ERROR`);
        console.log(`  Message: ${error.message}`);
        console.log(`  Code: ${error.code}\n`);
      } else {
        console.log(`[Schema: location] Table: ${table} -> LIVES/ACTIVE ✅`);
        console.log(`  Records retrieved: ${data.length}\n`);
      }
    } catch (e) {
      console.log(`[Schema: location] Table: ${table} -> ❌ EXCEPTION: ${e.message}\n`);
    }
  }
}

checkLocationSchema();
