const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPublicRPC() {
  console.log('Testing execute_sql on public schema...');
  const resRPC = await supabase.rpc("execute_sql", {
    query: "SELECT schema_name FROM information_schema.schemata;" // Let's try parameter named 'query' or 'sql'
  });

  if (resRPC.error) {
    console.log('public.execute_sql Error:', resRPC.error);
    
    // Let's try parameter named 'sql'
    console.log('Retrying with parameter name "sql"...');
    const resRPC2 = await supabase.rpc("execute_sql", {
      sql: "SELECT schema_name FROM information_schema.schemata;"
    });
    
    if (resRPC2.error) {
      console.log('public.execute_sql (sql parameter) Error:', resRPC2.error);
    } else {
      console.log('public.execute_sql Success! Schemas:');
      console.log(resRPC2.data);
    }
  } else {
    console.log('public.execute_sql Success! Schemas:');
    console.log(resRPC.data);
  }
}

checkPublicRPC();
