const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  try {
    const { data, error } = await serviceClient
      .schema('information_schema')
      .from('columns')
      .select('column_name, data_type')
      .eq('table_name', 'driver_jobs')
      .eq('table_schema', 'driver');

    if (error) {
      console.log('PostgREST query failed, trying public search path query...');
      const { data: data2, error: error2 } = await serviceClient
        .from('columns')
        .select('column_name')
        .eq('table_name', 'driver_jobs');
      if (error2) {
        console.error('All schema queries failed:', error2);
      } else {
        console.log('Columns:', data2);
      }
    } else {
      console.log('Driver Jobs columns in driver schema:', data);
    }
  } catch (e) {
    console.error('Caught error:', e);
  }
}

check();
