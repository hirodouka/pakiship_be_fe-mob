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
    .from('parcel_draft_items')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching parcel draft items:', error);
  } else {
    console.log('--- Parcel Draft Items Row ---');
    console.log(JSON.stringify(data, null, 2));
  }
}

inspect();
