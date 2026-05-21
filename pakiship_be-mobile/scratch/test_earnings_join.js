const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const operatorUserId = '930f6d2c-7338-4b0c-9824-9d41faefbb65'; // Keith San Miguel or Bopbopgurl or another
const hubId = '75d1f885-30db-4417-a068-d069a31a980c'; // Any active hub ID

async function main() {
  console.log("Testing join on routing.operator_earnings -> parcel_hub_records...");
  const { data, error } = await supabase
    .schema('routing')
    .from('operator_earnings')
    .select(`
      amount,
      earned_at,
      parcel_hub_records:parcel_hub_record_id (
        operator_user_id
      )
    `)
    .limit(1);

  if (error) {
    console.error("Join Error:", error.message);
  } else {
    console.log("Join Success:", data);
  }
}

main();
