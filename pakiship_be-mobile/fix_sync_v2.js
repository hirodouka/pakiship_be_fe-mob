require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Final Status Sync (v2) ---');
  
  const { data: jobs, error: err1 } = await supabase
    .from('driver_jobs')
    .select('job_number, driver_user_id, status, parcel_draft_id');
    
  if (err1) {
    console.error('Error fetching jobs:', err1);
    return;
  }

  for (const job of jobs) {
    console.log(`[${job.job_number}] Status: ${job.status}`);
    
    let label = null;
    let percentage = 0;
    
    if (job.status === 'in-progress') {
      label = 'Confirmed';
      percentage = 25;
    } else if (job.status === 'completed') {
      label = 'Delivered';
      percentage = 100;
    }

    if (label) {
      const { error: updErr } = await supabase
        .from('parcel_drafts')
        .update({ 
          assigned_driver_id: job.driver_user_id,
          tracking_progress_label: label,
          tracking_progress_percentage: percentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.parcel_draft_id);

      if (updErr) {
        console.error(`[${job.job_number}] Update failed:`, updErr.message);
      } else {
        console.log(`[${job.job_number}] Synced to '${label}'.`);
      }
    }
  }
}

main();
