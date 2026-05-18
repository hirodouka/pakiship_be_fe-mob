const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Querying columns for operator_earnings...");
  const { data, error } = await supabase
    .schema('information_schema')
    .from('columns')
    .select('column_name, data_type')
    .eq('table_schema', 'routing')
    .eq('table_name', 'operator_earnings');

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Columns:", data);
  }

  console.log("\nQuerying columns for operator_incentives...");
  const { data: data2, error: error2 } = await supabase
    .schema('information_schema')
    .from('columns')
    .select('column_name, data_type')
    .eq('table_schema', 'routing')
    .eq('table_name', 'operator_incentives');

  if (error2) {
    console.error("Error2:", error2.message);
  } else {
    console.log("Columns2:", data2);
  }
}

main();
