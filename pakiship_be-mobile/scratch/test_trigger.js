const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetId = '0512365a-4b64-458c-a6b7-fbc745107b45'; // backeithan@gmail.com
  console.log("1. Fetching current profile full_name...");
  
  const { data: profile, error: getErr } = await supabase
    .schema('account')
    .from('profiles')
    .select('full_name')
    .eq('id', targetId)
    .single();

  if (getErr) {
    console.error("Get error:", getErr.message);
    return;
  }

  const oldName = profile.full_name;
  const newName = oldName.includes("Updated") ? "Keitooo Keitooo" : "Keitooo Keitooo Updated";
  console.log(`Current name: "${oldName}", setting to: "${newName}"...`);

  // 2. Perform the update
  const { error: updateErr } = await supabase
    .schema('account')
    .from('profiles')
    .update({ full_name: newName })
    .eq('id', targetId);

  if (updateErr) {
    console.error("Update error:", updateErr.message);
    return;
  }
  console.log("Profile updated successfully!");

  // 3. Wait 2 seconds and check if a new log was created in partner.activity_logs
  console.log("Waiting 2 seconds for any database triggers to fire...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { data: logs, error: logsErr } = await supabase
    .schema('partner')
    .from('activity_logs')
    .select('*')
    .order('id', { ascending: false })
    .limit(3);

  if (logsErr) {
    console.error("Logs error:", logsErr.message);
    return;
  }

  console.log("\nLatest 3 logs in partner.activity_logs:");
  console.log(JSON.stringify(logs, null, 2));
}

main();
