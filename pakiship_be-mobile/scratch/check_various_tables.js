const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: earnings, error: err1 } = await serviceClient
    .schema('routing')
    .from('operator_earnings')
    .select('*')
    .limit(1);

  console.log('routing.operator_earnings:', err1 ? err1.message : 'SUCCESS');

  const { data: incentives, error: err2 } = await serviceClient
    .schema('routing')
    .from('operator_incentives')
    .select('*')
    .limit(1);

  console.log('routing.operator_incentives:', err2 ? err2.message : 'SUCCESS');
}

test();
