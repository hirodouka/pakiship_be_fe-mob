const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const probes = ['operator_id', 'user_id', 'operator_user_id', 'amount', 'hub_id', 'earned_at'];
  for (const col of probes) {
    const { error } = await supabase
      .schema('routing')
      .from('operator_earnings')
      .select(col)
      .limit(1);
    
    if (error) {
      console.log(`operator_earnings column "${col}": ERROR - ${error.message}`);
    } else {
      console.log(`operator_earnings column "${col}": EXISTS!`);
    }
  }

  console.log("\nProbing operator_incentives...");
  const probes2 = ['operator_id', 'user_id', 'operator_user_id', 'amount', 'hub_id', 'awarded_at'];
  for (const col of probes2) {
    const { error } = await supabase
      .schema('routing')
      .from('operator_incentives')
      .select(col)
      .limit(1);
    
    if (error) {
      console.log(`operator_incentives column "${col}": ERROR - ${error.message}`);
    } else {
      console.log(`operator_incentives column "${col}": EXISTS!`);
    }
  }
}

main();
