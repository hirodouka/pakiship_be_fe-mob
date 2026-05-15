require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- Fixing Customer Names ---');
  
  // Find all jobs where customer_name is 'Me' or null
  const { data: jobs, error } = await supabase
    .from('driver_jobs')
    .select('id, parcel_draft_id')
    .or('customer_name.eq.Me,customer_name.is.null');

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  console.log(`Found ${jobs.length} jobs to fix.`);

  for (const job of jobs) {
    if (!job.parcel_draft_id) continue;

    // Get the parcel draft to find the user_id
    const { data: draft } = await supabase
      .from('parcel_drafts')
      .select('user_id')
      .eq('id', job.parcel_draft_id)
      .maybeSingle();

    if (draft?.user_id) {
      // Get the real name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', draft.user_id)
        .maybeSingle();

      if (profile?.full_name) {
        console.log(`Updating Job ${job.id} to name: ${profile.full_name}`);
        await supabase
          .from('driver_jobs')
          .update({ customer_name: profile.full_name })
          .eq('id', job.id);
      }
    }
  }

  console.log('--- Done! ---');
}

main();
