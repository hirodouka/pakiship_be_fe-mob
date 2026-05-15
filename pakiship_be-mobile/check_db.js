require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'parcel_drafts'::regclass;"
  });
  
  if (error) {
    console.error('RPC Error:', error);
    // If RPC fails, try a direct query if possible, or just list distinct statuses again but more thoroughly
    const { data: statuses } = await supabase.from('parcel_drafts').select('status');
    console.log('Distinct statuses in table:', [...new Set(statuses.map(s => s.status))]);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

main();
