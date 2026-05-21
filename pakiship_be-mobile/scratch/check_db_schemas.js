const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Fetching database table list and schemas...\n");

  const { data, error } = await supabase.rpc('get_tables_info');

  if (error) {
    console.error("Error executing RPC:", error.message);
    // If RPC doesn't exist, query pg_catalog directly
    const { data: rawData, error: rawError } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename')
      .in('schemaname', ['public', 'account', 'parcel', 'driver', 'partner', 'routing']);
      
    if (rawError) {
      console.error("Error querying pg_tables:", rawError.message);
    } else {
      console.log("Tables in database:");
      console.log(JSON.stringify(rawData, null, 2));
    }
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
