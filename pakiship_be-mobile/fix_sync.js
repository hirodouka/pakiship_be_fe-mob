require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Fixing Out-of-Sync Parcel Statuses ---');
  
  // 1. Find all driver_jobs that are in-progress
  const { data: jobs, error: err1 } = await supabase
    .from('driver_jobs')
    .select('job_number, driver_user_id, status, parcel_draft_id')
    .eq('status', 'in-progress');
    
  if (err1) {
    console.error('Error fetching jobs:', err1);
    return;
  }

  for (const job of jobs) {
    console.log(`[${job.job_number}] Processing...`);
    
    // Update parcel_drafts to 'accepted' or 'picked-up'
    const { error: updErr } = await supabase
      .from('parcel_drafts')
      .update({ 
        status: 'accepted', // We'll set to accepted to show 'Confirmed'
        assigned_driver_id: job.driver_user_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.parcel_draft_id)
      .eq('status', 'submitted'); // Only update if still 'submitted'

    if (updErr) {
      console.error(`[${job.job_number}] Update failed:`, updErr.message);
    } else {
      console.log(`[${job.job_number}] Synced to 'accepted' status.`);
    }
  }
}

main();
