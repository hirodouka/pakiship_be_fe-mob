const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkParcelRPC() {
  console.log('Testing execute_sql on parcel schema...');
  const resRPC = await supabase.schema("parcel").rpc("execute_sql", {
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'parcel';"
  });

  if (resRPC.error) {
    console.log('parcel.execute_sql Error:', resRPC.error);
  } else {
    console.log('parcel.execute_sql Success. Tables in parcel schema:');
    console.log(resRPC.data);
  }
}

checkParcelRPC();
