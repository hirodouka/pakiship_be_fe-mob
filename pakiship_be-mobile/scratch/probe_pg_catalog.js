const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Probing pg_catalog.pg_attribute...");
  const { data, error } = await supabase
    .schema('pg_catalog')
    .from('pg_attribute')
    .select('attname')
    .limit(5);

  if (error) {
    console.error("pg_attribute Error:", error.message);
  } else {
    console.log("pg_attribute Success:", data);
  }
}

main();
