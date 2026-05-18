const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probe(schema, table) {
  const { data, error } = await supabase
    .schema(schema)
    .from(table)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`[${schema}.${table}] ERROR: ${error.message}`);
  } else {
    console.log(`[${schema}.${table}] OK! Rows: ${data.length}`);
  }
}

async function main() {
  await probe('account', 'profiles');
  await probe('account', 'customer_activity_logs');
  await probe('parcel', 'parcel_activity_logs');
  await probe('partner', 'activity_logs');
}

main();
