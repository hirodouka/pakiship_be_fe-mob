require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- LATEST AVAILABLE JOB DETAIL ---');
  const { data: jobs, error } = await supabase
    .from('driver_jobs')
    .select('*')
    .is('driver_user_id', null)
    .limit(1);
    
  if (jobs && jobs[0]) {
    console.log(jobs[0]);
  } else {
    console.log('No available jobs found');
  }
}

main();
