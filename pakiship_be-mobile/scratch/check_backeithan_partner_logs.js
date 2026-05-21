const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetId = '0512365a-4b64-458c-a6b7-fbc745107b45'; // backeithan@gmail.com
  console.log(`Checking if partner.activity_logs has any entries for ${targetId}...\n`);

  const { data, error } = await supabase
    .schema('partner')
    .from('activity_logs')
    .select('*')
    .eq('userId', targetId);

  if (error) {
    console.error("Error reading logs:", error.message);
  } else {
    console.log(`Found ${data.length} logs for backeithan@gmail.com:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
