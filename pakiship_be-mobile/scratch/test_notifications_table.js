const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("1. Querying account.customer_notifications...");
  const { data: data1, error: err1 } = await supabase
    .schema('account')
    .from('customer_notifications')
    .select('*')
    .limit(1);

  if (err1) {
    console.error("account.customer_notifications error:", err1.message);
  } else {
    console.log("account.customer_notifications success:", data1);
  }

  console.log("\n2. Querying notifications.notifications...");
  const { data: data2, error: err2 } = await supabase
    .schema('notifications')
    .from('notifications')
    .select('*')
    .limit(1);

  if (err2) {
    console.error("notifications.notifications error:", err2.message);
  } else {
    console.log("notifications.notifications success:", data2);
  }

  console.log("\n3. Querying public.customer_notifications...");
  const { data: data3, error: err3 } = await supabase
    .from('customer_notifications') // public
    .select('*')
    .limit(1);

  if (err3) {
    console.error("public.customer_notifications error:", err3.message);
  } else {
    console.log("public.customer_notifications success:", data3);
  }
}

main();
