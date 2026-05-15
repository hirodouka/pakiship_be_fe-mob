require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Syncing Missing Driver Jobs ---');
  
  // 1. Get all submitted/accepted parcels that don't have a driver job yet
  const { data: drafts, error: err1 } = await supabase
    .from('parcel_drafts')
    .select('*, parcel_draft_items(*)')
    .in('status', ['submitted', 'accepted', 'picked-up', 'out-for-delivery']);
    
  if (err1) {
    console.error('Error fetching drafts:', err1);
    return;
  }

  console.log(`Found ${drafts.length} active drafts.`);

  for (const draft of drafts) {
    // Check if job already exists
    const { data: existing } = await supabase
      .from('driver_jobs')
      .select('id')
      .eq('parcel_draft_id', draft.id)
      .maybeSingle();

    if (existing) {
      console.log(`[${draft.tracking_number}] Job already exists. Skipping.`);
      continue;
    }

    console.log(`[${draft.tracking_number}] Creating missing job...`);
    
    // Fetch customer name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', draft.user_id)
      .maybeSingle();
      
    const customerName = profile?.full_name || draft.sender_name || 'Customer';
    
    // Insert job
    const { error: insErr } = await supabase.from('driver_jobs').insert({
      job_number: draft.tracking_number,
      pickup_address: draft.pickup_address,
      dropoff_address: draft.delivery_address,
      distance_text: draft.distance_text,
      earnings_amount: 85, // Default for sync
      status: 'available',
      parcel_status: null, // Fixed to avoid constraint violation
      customer_user_id: draft.user_id,
      customer_name: customerName,
      customer_phone: draft.sender_phone,
      package_size: 'Small',
      package_description: 'Synced Parcel',
      parcel_draft_id: draft.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insErr) {
      console.error(`[${draft.tracking_number}] Failed to create job:`, insErr.message);
    } else {
      console.log(`[${draft.tracking_number}] Success!`);
    }
  }
}

main();
