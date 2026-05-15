require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Testing connection and listing tables...');
  
  const { data: tables, error: tablesError } = await supabase.rpc('execute_sql', {
    sql: "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_name = 'parcel_drafts';"
  });

  if (tablesError) {
    console.error('RPC execute_sql failed:', tablesError.message);
  } else {
    console.log('parcel_drafts locations:', tables);
  }
}

main();
