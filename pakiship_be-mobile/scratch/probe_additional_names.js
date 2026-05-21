const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const candidates = [
  'operator_hub_assignment_id', 'parcel_hub_record_id', 'operator_assignment_id', 'operator_session_id',
  'assignment_id', 'operator_profile_id', 'recipient_id', 'sender_id', 'driver_user_id', 'driver_id',
  'rider_id', 'rider_user_id', 'hub_id', 'amount', 'earned_at', 'parcel_draft_id', 'created_at', 'updated_at',
  'awarded_at', 'operator_user_id', 'user_id', 'operator_id', 'incentive_type', 'type', 'notes', 'status',
  'operator_hub_assignment'
];

async function main() {
  console.log("Probing routing.operator_earnings columns...");
  for (const col of candidates) {
    const { error } = await supabase
      .schema('routing')
      .from('operator_earnings')
      .select(col)
      .limit(1);
    
    if (!error || !error.message.includes('does not exist')) {
      console.log(`[operator_earnings] column "${col}" EXISTS!`);
    }
  }

  console.log("\nProbing routing.operator_incentives columns...");
  for (const col of candidates) {
    const { error } = await supabase
      .schema('routing')
      .from('operator_incentives')
      .select(col)
      .limit(1);
    
    if (!error || !error.message.includes('does not exist')) {
      console.log(`[operator_incentives] column "${col}" EXISTS!`);
    }
  }
}

main();
