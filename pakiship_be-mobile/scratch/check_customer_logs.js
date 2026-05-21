const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Checking customer_activity_logs table...\n");

  const { data: logs, error } = await supabase
    .schema('account')
    .from('customer_activity_logs')
    .select('*')
    .limit(10);

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Logs in customer_activity_logs:");
    console.log(JSON.stringify(logs, null, 2));
  }
}

main();
