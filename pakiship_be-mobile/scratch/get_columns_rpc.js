const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Fetching columns for routing.operator_earnings using RPC...");
  
  const { data: cols, error } = await supabase.rpc('get_raw_sql', {
    sql_query: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'routing' 
        AND table_name = 'operator_earnings';
    `
  });

  if (error) {
    console.error("RPC Error:", error.message);
  } else {
    console.log("operator_earnings columns:", cols);
  }

  console.log("\nFetching columns for routing.operator_incentives using RPC...");
  const { data: cols2, error: error2 } = await supabase.rpc('get_raw_sql', {
    sql_query: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'routing' 
        AND table_name = 'operator_incentives';
    `
  });

  if (error2) {
    console.error("RPC Error 2:", error2.message);
  } else {
    console.log("operator_incentives columns:", cols2);
  }
}

main();
