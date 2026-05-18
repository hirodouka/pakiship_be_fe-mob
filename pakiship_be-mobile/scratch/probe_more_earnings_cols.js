const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const probes = [
    'operator_profile_id',
    'operator_user',
    'hub_operator_id',
    'operator_hub_assignment_id',
    'profile_id',
    'operator',
    'user',
    'driver',
    'rider',
    'driver_id',
    'rider_id'
  ];
  for (const col of probes) {
    const { error } = await supabase
      .schema('routing')
      .from('operator_earnings')
      .select(col)
      .limit(1);
    
    if (error) {
      // If it says column yyy does not exist, then it's wrong.
      // But if it returns success or another error (like table empty / no rows), it means the column EXISTS!
      if (!error.message.includes('does not exist')) {
        console.log(`operator_earnings column "${col}": EXISTS! (Returned: ${error.message})`);
      } else {
        console.log(`operator_earnings column "${col}": ERROR - ${error.message}`);
      }
    } else {
      console.log(`operator_earnings column "${col}": EXISTS!`);
    }
  }
}

main();
