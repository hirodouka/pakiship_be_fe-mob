const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetId = '8ca071ae-f3e0-4268-acef-f16cec1ff978';
  console.log(`Checking profile and auth user for ${targetId}...\n`);

  const { data: profile, error: profileErr } = await supabase
    .schema('account')
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();

  if (profileErr) {
    console.error("Profile error:", profileErr.message);
  } else {
    console.log("Profile details:");
    console.log(JSON.stringify(profile, null, 2));
  }

  console.log("\n-------------------------------------------------\n");

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(targetId);
  if (authErr) {
    console.error("Auth error:", authErr.message);
  } else {
    console.log("Auth user details:");
    console.log(JSON.stringify(authUser.user, null, 2));
  }
}

main();
