require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function debugOperator() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .schema('account')
    .from('profiles')
    .select('*')
    .eq('role', 'operator');

  if (error) {
    console.error('Error fetching operator:', error);
  } else {
    console.log('Operator profiles:', JSON.stringify(data, null, 2));
  }
}

debugOperator().catch(console.error);
