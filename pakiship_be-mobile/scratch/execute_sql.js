const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sql = `
    SELECT 
      t.tgname AS trigger_name,
      c.relname AS table_name,
      p.proname AS function_name,
      pg_get_functiondef(p.oid) AS function_definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'account' AND c.relname = 'profiles';
  `;

  console.log("Querying database triggers on account.profiles...\n");

  const { data, error } = await supabase.rpc('get_raw_sql', {
    sql_query: sql
  });

  if (error) {
    console.error("RPC error:", error.message);
  } else {
    console.log("Successfully fetched triggers on account.profiles:");
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
