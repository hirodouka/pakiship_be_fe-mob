require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function debugAssignment() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .schema('parcel')
    .from('operator_hub_assignments')
    .select('*')
    .eq('operator_user_id', '9e6bb2cd-845d-4d0c-bad7-80800b6563c7');

  if (error) {
    console.error('Error fetching assignment:', error);
  } else {
    console.log('Hub assignments:', JSON.stringify(data, null, 2));
  }
}

debugAssignment().catch(console.error);
