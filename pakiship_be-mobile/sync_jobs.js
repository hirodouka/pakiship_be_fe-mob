require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Syncing Missing Driver Jobs ---');
  
  // 1. Get all submitted/accepted parcels that don't have a driver job yet
  const { data: drafts, error: err1 } = await supabase
    .schema('parcel')
    .from('parcel_drafts')
    .select('*')
    .in('status', ['submitted', 'accepted', 'picked-up', 'out-for-delivery']);
    
  if (err1) {
    console.error('Error fetching drafts:', err1);
    return;
  }

  console.log(`Found ${drafts.length} active drafts.`);

  for (const draft of drafts) {
    // Check if job already exists
    const { data: existing, error: existErr } = await supabase
      .schema('driver')
      .from('driver_jobs')
      .select('id')
      .eq('parcel_draft_id', draft.id)
      .maybeSingle();

    if (existErr) {
      console.error(`[${draft.tracking_number}] Error checking existing job:`, existErr.message);
      continue;
    }

    if (existing) {
      console.log(`[${draft.tracking_number}] Job already exists. Skipping.`);
      continue;
    }

    // Fetch customer name
    let customerName = draft.sender_name || 'Customer';
    try {
      const { data: profile } = await supabase
        .schema('account')
        .from('profiles')
        .select('full_name')
        .eq('id', draft.user_id)
        .maybeSingle();
      if (profile && profile.full_name) {
        customerName = profile.full_name;
      }
    } catch (e) {
      console.warn(`[${draft.tracking_number}] Error fetching profile:`, e.message || e);
    }
    
    const servicePrice = Number(draft.service_price ?? 0);
    const earnings = servicePrice > 0 ? Math.round(servicePrice * 0.7) : 85;

    console.log(`[${draft.tracking_number}] Creating missing job...`);

    // Insert job using the exact custom schema columns
    const { error: insErr } = await supabase
      .schema('driver')
      .from('driver_jobs')
      .insert({
        job_number: draft.tracking_number,
        parcel_draft_id: draft.id,
        status: 'available',
        earnings: earnings
      });

    if (insErr) {
      console.error(`[${draft.tracking_number}] Failed to create job:`, insErr.message);
    } else {
      console.log(`[${draft.tracking_number}] Success!`);
    }
  }
}

main();
