const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Querying parcel.parcel_drafts...");
  const { data: parcelData, error: parcelErr } = await supabase
    .schema('parcel')
    .from('parcel_drafts')
    .select('id, tracking_number')
    .limit(1);

  if (parcelErr) {
    console.error("parcel.parcel_drafts error:", parcelErr.message);
  } else {
    console.log("parcel.parcel_drafts success:", parcelData);
  }

  console.log("\nQuerying public.parcel_drafts...");
  const { data: publicData, error: publicErr } = await supabase
    .from('parcel_drafts') // default is public
    .select('id, tracking_number')
    .limit(1);

  if (publicErr) {
    console.error("public.parcel_drafts error:", publicErr.message);
  } else {
    console.log("public.parcel_drafts success:", publicData);
  }
}

main();
