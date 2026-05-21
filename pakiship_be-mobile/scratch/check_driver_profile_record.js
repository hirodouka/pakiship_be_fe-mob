const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const driverUserId = 'e2e1eff2-24e1-42ac-b6f8-57d30f265ae0';

async function main() {
  console.log(`Querying account.profiles for driver_user_id = ${driverUserId}...`);
  
  const { data: profile, error: err } = await supabase
    .schema('account')
    .from('profiles')
    .select('*')
    .eq('id', driverUserId)
    .maybeSingle();

  if (err) {
    console.error("profiles error:", err.message);
  } else {
    console.log("profiles success:", profile);
  }
}

main();
