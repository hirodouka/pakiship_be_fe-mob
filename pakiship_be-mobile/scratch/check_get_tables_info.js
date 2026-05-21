const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGetTablesInfo() {
  console.log('Testing get_tables_info on public schema...');
  const { data, error } = await supabase.rpc('get_tables_info');

  if (error) {
    console.log('get_tables_info Error:', error);
  } else {
    console.log('get_tables_info Success! Tables info:');
    console.log(data);
  }
}

checkGetTablesInfo();
