require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Testing execute_sql on account schema...');
  const resRPC = await supabase.schema("account").rpc("execute_sql", {
    sql: "SELECT 1;"
  });
  if (resRPC.error) {
    console.log('account.execute_sql Error:', resRPC.error);
  } else {
    console.log('account.execute_sql Success:', resRPC.data);
  }
}

main();
