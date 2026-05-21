const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const trackingNumber = 'PKS-2026-350252';

async function main() {
  console.log(`Querying driver.driver_jobs for job_number = ${trackingNumber}...`);
  
  const { data: job, error: jobErr } = await supabase
    .schema('driver')
    .from('driver_jobs')
    .select('*')
    .eq('job_number', trackingNumber)
    .maybeSingle();

  if (jobErr) {
    console.error("driver_jobs error:", jobErr.message);
  } else {
    console.log("driver_jobs success:", job);
  }

  // Let's also check if there is an assigned driver in parcel_drafts for this tracking number
  console.log(`\nQuerying parcel.parcel_drafts for tracking_number = ${trackingNumber}...`);
  const { data: draft, error: draftErr } = await supabase
    .schema('parcel')
    .from('parcel_drafts')
    .select('id, tracking_number, status, assigned_driver_id')
    .eq('tracking_number', trackingNumber)
    .maybeSingle();

  if (draftErr) {
    console.error("parcel_drafts error:", draftErr.message);
  } else {
    console.log("parcel_drafts success:", draft);
  }
}

main();
