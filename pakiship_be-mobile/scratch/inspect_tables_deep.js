const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const schemas = ['parcel', 'routing'];
const tables = [
  'hubs',
  'drop_off_points',
  'dropoff_points',
  'drop_off_hubs',
  'hubs_list',
  'pickup_hubs',
  'relay_hubs'
];

async function run() {
  for (const schema of schemas) {
    for (const table of tables) {
      const { data, error } = await serviceClient
        .schema(schema)
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`[${schema}.${table}] -> ERROR: ${error.message} (code: ${error.code})`);
      } else {
        console.log(`[${schema}.${table}] -> SUCCESS! Columns: ${Object.keys(data[0] || {}).join(', ')}`);
      }
    }
  }
}

run();
