const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Checking for database triggers, functions, or constraints that might write to partner.activity_logs...\n");

  // We can query custom functions or triggers by running an RPC if one is available.
  // Wait, let's look at the rows in partner.activity_logs again!
  const { data: logs, error } = await supabase
    .schema('partner')
    .from('activity_logs')
    .select('*')
    .order('id', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error reading logs:", error.message);
    return;
  }

  console.log("Latest logs in partner.activity_logs:");
  console.log(JSON.stringify(logs, null, 2));
}

main();
