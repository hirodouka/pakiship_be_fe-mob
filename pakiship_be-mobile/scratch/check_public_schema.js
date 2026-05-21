require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Probing public.driver_jobs...');
  const { data, error } = await supabase.from('driver_jobs').select('id').limit(1);
  if (error) {
    console.error('Error querying public.driver_jobs without schema:', error.message);
  } else {
    console.log('Success! public.driver_jobs is queryable. Rows found:', data.length);
  }

  console.log('\nProbing with explicit .schema("public")...');
  const { data: dataPublic, error: errorPublic } = await supabase.schema('public').from('driver_jobs').select('id').limit(1);
  if (errorPublic) {
    console.error('Error querying public.driver_jobs with explicit public schema:', errorPublic.message);
  } else {
    console.log('Success with explicit public schema! Rows found:', dataPublic.length);
  }
}

main();
