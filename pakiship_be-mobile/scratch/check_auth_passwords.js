require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');

async function checkPasswords() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const email = "backeithan@gmail.com";
  const passwordsToTest = [
    "RobertPogi1-",
    "RobertPogi1",
    "RobertPogi1_",
    "RobertPogi123",
    "RobertPogi123-",
    "backeithan",
    "eithan"
  ];

  console.log(`Testing passwords for ${email}...`);

  for (const password of passwordsToTest) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error && data && data.user) {
      console.log(`\n🎉 SUCCESS! Password matched: "${password}"`);
      return;
    } else {
      console.log(`❌ Failed: "${password}" (${error?.message})`);
    }
  }

  console.log("\nNone of the tested passwords matched.");
}

checkPasswords().catch(console.error);
