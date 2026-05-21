require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Querying parcel.parcel_draft_items columns...');
  const { data: cols, error: colErr } = await supabase.schema('parcel').from('parcel_draft_items').select('*').limit(1);
  if (colErr) {
    console.error('Could not select from parcel.parcel_draft_items:', colErr.message);
  } else {
    console.log('Success! Columns in parcel.parcel_draft_items:', Object.keys(cols[0] || {}));
  }
}

main();
