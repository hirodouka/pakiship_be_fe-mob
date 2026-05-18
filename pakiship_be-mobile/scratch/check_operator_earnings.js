const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Querying routing.operator_earnings structure...");
  const { data: earnData, error: earnErr } = await supabase
    .schema('routing')
    .from('operator_earnings')
    .select('*')
    .limit(1);

  if (earnErr) {
    console.error("operator_earnings error:", earnErr.message);
  } else {
    console.log("operator_earnings success/data:", earnData);
  }

  console.log("\nQuerying routing.operator_incentives structure...");
  const { data: incData, error: incErr } = await supabase
    .schema('routing')
    .from('operator_incentives')
    .select('*')
    .limit(1);

  if (incErr) {
    console.error("operator_incentives error:", incErr.message);
  } else {
    console.log("operator_incentives success/data:", incData);
  }
}

main();
