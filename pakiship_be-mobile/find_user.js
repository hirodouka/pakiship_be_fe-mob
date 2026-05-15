require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const email = 'keithsanmiguel@pakiship.com';
  console.log(`Searching for email: ${email}...`);

  // 1. Check Auth Users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error fetching auth users:', authError.message);
  } else {
    const authUser = authData.users.find(u => u.email === email);
    if (authUser) {
      console.log('Found in Auth.Users:');
      console.log(JSON.stringify(authUser, null, 2));
    } else {
      console.log('Not found in Auth.Users');
    }
  }

  // 2. Check parcel_drafts table in different schemas
  const schemas = ['public', 'account', 'parcel', 'driver'];
  for (const schema of schemas) {
    console.log(`Checking schema: ${schema}...`);
    const { data, error } = await supabase
      .schema(schema)
      .from('parcel_drafts')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log(`  Error searching ${schema}.parcel_drafts:`, error.message);
    } else {
      console.log(`  Found ${schema}.parcel_drafts table.`);
    }
  }
}

main();
