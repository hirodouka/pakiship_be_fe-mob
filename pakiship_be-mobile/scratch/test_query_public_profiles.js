const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Querying account.profiles...");
  const { data: accountData, error: accountErr } = await supabase
    .schema('account')
    .from('profiles')
    .select('id, email, full_name')
    .limit(1);

  if (accountErr) {
    console.error("account.profiles error:", accountErr.message);
  } else {
    console.log("account.profiles success:", accountData);
  }

  console.log("\nQuerying public.profiles...");
  const { data: publicData, error: publicErr } = await supabase
    .from('profiles') // default is public
    .select('id, email, full_name')
    .limit(1);

  if (publicErr) {
    console.error("public.profiles error:", publicErr.message);
  } else {
    console.log("public.profiles success:", publicData);
  }
}

main();
