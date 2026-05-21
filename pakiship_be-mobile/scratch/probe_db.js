const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Listing tables and testing if we can see any partner tables...");
  
  // We can query information_schema.tables using rpc or sql, but if we don't have SQL execution via RPC, we can probe it by querying.
  // Let's probe 'partner.activity_logs' directly!
  const { data, error } = await supabase
    .schema('partner')
    .from('activity_logs')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error reading partner.activity_logs:", error.message);
  } else {
    console.log("Successfully fetched from partner.activity_logs:");
    console.log(JSON.stringify(data, null, 2));
  }

  // Let's also check other schemas/tables by probing
  console.log("\nProbing other schemas/tables...");
  const schemas = ['account', 'parcel', 'partner', 'public'];
  const tables = {
    account: ['profiles', 'customer_activity_logs'],
    parcel: ['parcel_activity_logs'],
    partner: ['activity_logs', 'uploads'],
  };

  for (const schema of schemas) {
    const list = tables[schema] || [];
    for (const table of list) {
      const { data: testData, error: testErr } = await supabase
        .schema(schema)
        .from(table)
        .select('count', { count: 'exact', head: true });
      if (testErr) {
        console.log(`[${schema}.${table}] Error: ${testErr.message}`);
      } else {
        console.log(`[${schema}.${table}] Exists! Row count: ${testData.length}`);
      }
    }
  }
}

main();
