require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function debugHubs() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .schema('parcel')
    .from('drop_off_points')
    .select('id, name');

  if (error) {
    console.error('Error fetching hubs:', error);
  } else {
    console.log('Valid hubs:', JSON.stringify(data, null, 2));
  }
}

debugHubs().catch(console.error);
