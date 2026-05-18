require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function debugAuthUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const email = "backeithan@gmail.com";

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing:", error);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.log("No user found with email:", email);
    return;
  }

  console.log("================ SUPABASE AUTH USER ================");
  console.log(JSON.stringify(user, null, 2));
  console.log("====================================================");
}

debugAuthUser().catch(console.error);
