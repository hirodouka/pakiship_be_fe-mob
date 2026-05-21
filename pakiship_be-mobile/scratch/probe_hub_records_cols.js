const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const candidates = [
  'operator_user_id', 'operator_id', 'user_id', 'profile_id', 'driver_id', 'driver_user_id',
  'hub_id', 'status', 'storage_location', 'received_at', 'picked_up_at', 'dispatched_at',
  'created_at', 'updated_at', 'parcel_draft_id', 'assigned_operator_id'
];

async function main() {
  console.log("Probing parcel.parcel_hub_records columns...");
  for (const col of candidates) {
    const { error } = await supabase
      .schema('parcel')
      .from('parcel_hub_records')
      .select(col)
      .limit(1);
    
    if (!error || !error.message.includes('does not exist')) {
      console.log(`[parcel_hub_records] column "${col}" EXISTS!`);
    }
  }
}

main();
