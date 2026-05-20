const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const admin = serviceClient;
  
  console.log("Checking structure of parcel.parcel_drafts...");
  const { data: sample, error: sampleErr } = await admin
    .schema("parcel")
    .from("parcel_drafts")
    .select("*")
    .limit(1);
    
  if (sampleErr) {
    console.error("Error fetching parcel_drafts:", sampleErr);
  } else {
    console.log("parcel_drafts row:", sample[0]);
    console.log("Columns:", Object.keys(sample[0] || {}).join(', '));
  }
}

run();
