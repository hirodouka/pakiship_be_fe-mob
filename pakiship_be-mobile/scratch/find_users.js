const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Finding user with exact prefix matching...");
  
  const { data: profiles, error } = await supabase
    .schema('account')
    .from('profiles')
    .select('*');

  if (error) {
    console.error(error.message);
  } else {
    const p1 = profiles.find(p => p.id.startsWith('930f6d2c'));
    console.log("First User details:");
    console.log(JSON.stringify(p1, null, 2));
  }
}

main();
