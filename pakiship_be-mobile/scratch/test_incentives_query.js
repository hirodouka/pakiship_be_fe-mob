const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const hubId = '75d1f885-30db-4417-a068-d069a31a980c'; // Any active hub ID

async function main() {
  console.log("Testing routing.operator_incentives query by hub_id...");
  const { data, error } = await supabase
    .schema('routing')
    .from('operator_incentives')
    .select('amount')
    .eq('hub_id', hubId)
    .limit(5);

  if (error) {
    console.error("Query Error:", error.message);
  } else {
    console.log("Query Success:", data);
  }
}

main();
