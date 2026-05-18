const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const candidates = [
  'operator_user_id', 'operator_id', 'user_id', 'driver_user_id', 'driver_id', 'rider_user_id', 'rider_id',
  'employee_id', 'employee_user_id', 'staff_id', 'staff_user_id', 'admin_id', 'admin_user_id', 'member_id',
  'member_user_id', 'profile_id', 'operator_profile_id', 'assigned_operator_id', 'assigned_to', 'assigned_user_id',
  'created_by', 'operator_user', 'operator_code', 'operator_name', 'operator_username', 'operator_email',
  'email', 'username', 'name', 'hub_operator_id', 'status', 'type', 'description', 'notes', 'reference_id',
  'order_id', 'parcel_id', 'parcel_draft_id', 'job_id', 'transaction_id', 'payment_id', 'created_at', 'updated_at',
  'awarded_at'
];

async function main() {
  console.log("Probing routing.operator_earnings...");
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

  console.log("\nProbing routing.operator_incentives...");
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
