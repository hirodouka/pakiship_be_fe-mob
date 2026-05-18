const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const operatorUserId = '930f6d2c-7338-4b0c-9824-9d41faefbb65'; // Bopbopgurl or another
const hubId = '75d1f885-30db-4417-a068-d069a31a980c'; // Any active hub ID

async function main() {
  console.log("1. Fetching parcel_hub_records for operator...");
  const { data: records, error: recError } = await supabase
    .schema('parcel')
    .from('parcel_hub_records')
    .select('id')
    .eq('operator_user_id', operatorUserId)
    .eq('hub_id', hubId);

  if (recError) {
    console.error("Fetch records error:", recError.message);
    return;
  }

  const recordIds = (records || []).map(r => r.id);
  console.log("Record IDs found:", recordIds);

  console.log("\n2. Querying routing.operator_earnings using in filter...");
  // If recordIds is empty, we don't query or query with empty array
  const { data: earnings, error: earnError } = await supabase
    .schema('routing')
    .from('operator_earnings')
    .select('amount')
    .eq('hub_id', hubId)
    .in('parcel_hub_record_id', recordIds.length > 0 ? recordIds : ['00000000-0000-0000-0000-000000000000']);

  if (earnError) {
    console.error("Query earnings error:", earnError.message);
  } else {
    console.log("Query earnings success:", earnings);
  }
}

main();
