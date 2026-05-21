require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Supabase URL:", supabaseUrl);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log("Attempting direct login...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "backeithan@gmail.com",
    password: "RobertPogi1-"
  });

  if (error) {
    console.error("Direct Auth Login Failed:", error.message);
  } else {
    console.log("Direct Auth Login Successful!", {
      id: data.user.id,
      email: data.user.email
    });
  }
}

testSupabaseAuth().catch(console.error);
