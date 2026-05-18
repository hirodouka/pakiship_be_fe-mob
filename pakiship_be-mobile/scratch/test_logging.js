const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetId = '0512365a-4b64-458c-a6b7-fbc745107b45'; // backeithan@gmail.com
  console.log(`Writing test log directly to partner.activity_logs for ${targetId}...\n`);

  const { data, error } = await supabase
    .schema('partner')
    .from('activity_logs')
    .insert({
      userId: targetId,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: targetId,
      description: 'customer login',
      severity: 'info'
    })
    .select();

  if (error) {
    console.error("Error inserting log:", error.message);
  } else {
    console.log("Log inserted successfully:", JSON.stringify(data, null, 2));
  }
}

main();
