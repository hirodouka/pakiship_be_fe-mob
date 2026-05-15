const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllJobs() {
  console.log('Starting global fix for all customer names...');
  
  // 1. Fetch all jobs
  const { data: jobs, error: jobsErr } = await supabase
    .schema('parcel')
    .from('driver_jobs')
    .select('id, job_number, parcel_draft_id, customer_user_id');

  if (jobsErr) {
    console.error('Error fetching jobs:', jobsErr);
    return;
  }

  console.log(`Found ${jobs.length} jobs. Synchronizing names...`);

  for (const job of jobs) {
    // 2. Fetch both draft and profile
    const [draftRes, profileRes] = await Promise.all([
      job.parcel_draft_id ? supabase.schema('parcel').from('parcel_drafts').select('sender_name').eq('id', job.parcel_draft_id).maybeSingle() : Promise.resolve({ data: null }),
      job.customer_user_id ? supabase.schema('account').from('profiles').select('full_name').eq('id', job.customer_user_id).maybeSingle() : Promise.resolve({ data: null })
    ]);

    const senderName = draftRes.data?.sender_name;
    const profileName = profileRes.data?.full_name;

    console.log(`Job ${job.job_number}: Draft="${senderName}", Profile="${profileName}"`);

    // Prioritize profileName if senderName is "Me" or generic
    let finalName = senderName;
    if (!senderName || senderName.toLowerCase() === 'me' || senderName.toLowerCase() === 'customer') {
      finalName = profileName || senderName || "Customer";
    }

    if (finalName === 'Jods' && profileName && profileName !== 'Jods') {
        finalName = profileName;
    }

    // 3. Update the job
    console.log(`=> Setting to: "${finalName}"`);
    await supabase
      .schema('parcel')
      .from('driver_jobs')
      .update({ customer_name: finalName })
      .eq('id', job.id);
  }

  console.log('Done!');
}

fixAllJobs();
