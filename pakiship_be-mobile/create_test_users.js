require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function createUser(supabase, email, password, fullName, role) {
  console.log(`\n--- Creating User: ${email} (${role}) ---`);

  // 1. Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      console.log(`[Auth] User ${email} already exists. Fetching user info...`);
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error(`[Auth] Error listing users:`, listError.message);
        return;
      }
      const existingUser = listData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!existingUser) {
        console.error(`[Auth] Could not find existing user ${email} in list.`);
        return;
      }
      var userId = existingUser.id;
    } else {
      console.error(`[Auth] Error creating user ${email}:`, authError.message);
      return;
    }
  } else {
    var userId = authData.user.id;
    console.log(`[Auth] User created with ID: ${userId}`);
  }

  // 2. Create profile in account.profiles
  const { error: profileError } = await supabase
    .schema('account')
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      role: role,
    });

  if (profileError) {
    console.error(`[Profile] Error creating profile for ${email}:`, profileError.message);
  } else {
    console.log(`[Profile] Profile created successfully.`);
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env file.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Default Test Users
  await createUser(supabase, 'keithsanmiguel@pakiship.com', 'Charizard1@', 'Keith San Miguel', 'customer');
  await createUser(supabase, 'customer1@example.com', 'Password123!', 'Test Customer', 'customer');
  await createUser(supabase, 'driver1@example.com', 'Password123!', 'Test Driver', 'driver');
  await createUser(supabase, 'operator1@example.com', 'Password123!', 'Test Operator', 'operator');

  console.log('\n--- Done ---');
}

main();
