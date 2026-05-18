require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking Robert Doe's rating in DB...");
  const { data: profile, error: profileErr } = await supabase.schema('account').from('profiles').select('id, full_name, email').eq('email', 'robertdoe@gmail.com').single();
  
  if (profileErr || !profile) {
    console.log("Error finding profile:", profileErr);
    return;
  }
  
  console.log("Profile:", profile);
  
  const { data: jobs, error: jobsErr } = await supabase.schema('driver').from('driver_jobs').select('id, rating, status').eq('driver_user_id', profile.id);
  
  if (jobsErr) {
     console.log("Error finding jobs:", jobsErr);
     return;
  }
  
  console.log("Jobs for driver:", jobs);
  
  const ratingValues = jobs.map(j => Number(j.rating)).filter(r => r > 0 && !isNaN(r));
  const avg = ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : null;
  console.log("Computed Average:", avg);
}

check();
