const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data, error } = await serviceClient
    .schema('parcel')
    .from('drop_off_points')
    .select('*');

  if (error) {
    console.error('Error fetching hubs:', error);
  } else {
    console.log('--- Hubs List ---');
    console.log(JSON.stringify(data, null, 2));
  }
}

inspect();
