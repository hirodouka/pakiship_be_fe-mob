const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const emailToFind = 'backeithan@gmail.com';
  console.log(`Searching for email: "${emailToFind}"...\n`);

  // 1. Search in account.profiles
  console.log("--- 1. Searching in account.profiles table ---");
  const { data: profiles, error: profileError } = await supabase
    .schema('account')
    .from('profiles')
    .select('*')
    .eq('email', emailToFind);

  if (profileError) {
    console.error("Error fetching profile:", profileError.message);
  } else if (profiles && profiles.length > 0) {
    console.log("Found profile record:");
    console.log(JSON.stringify(profiles[0], null, 2));
  } else {
    console.log("No profile record found in account.profiles.");
  }

  console.log("\n--- 2. Searching in Supabase Auth ---");
  // 2. Search in auth.users
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("Error listing auth users:", authError.message);
  } else {
    const matchedUser = users.find(u => u.email && u.email.toLowerCase() === emailToFind.toLowerCase());
    if (matchedUser) {
      console.log("Found auth user record:");
      console.log(JSON.stringify({
        id: matchedUser.id,
        email: matchedUser.email,
        role: matchedUser.role,
        last_sign_in_at: matchedUser.last_sign_in_at,
        created_at: matchedUser.created_at,
        user_metadata: matchedUser.user_metadata,
      }, null, 2));
    } else {
      console.log("No user record found in Supabase Auth.");
    }
  }
}

main();
