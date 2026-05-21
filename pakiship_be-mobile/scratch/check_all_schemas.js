const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema(schemaName) {
  const { data, error } = await serviceClient
    .schema(schemaName)
    .from('drop_off_points')
    .select('*')
    .limit(1);

  if (error) {
    console.log(`Schema [${schemaName}] error:`, error.message);
  } else {
    console.log(`Schema [${schemaName}] SUCCESS:`, data);
  }
}

async function run() {
  await checkSchema('parcel');
  await checkSchema('account');
  await checkSchema('public');
  await checkSchema('routing');
}

run();
