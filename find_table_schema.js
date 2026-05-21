const { createClient } = require('c:\\Users\\Bopbopgurl\\Downloads\\pakiship-updates-update\\pakiship-updates-update\\pakiship_be-mobile\\node_modules\\@supabase\\supabase-js');

const db = createClient(
  'https://rregfrhtlmfktliijzpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZWdmcmh0bG1ma3RsaWlqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MDM1MSwiZXhwIjoyMDg2OTY2MzUxfQ.9rYx4nZkF_K278AZ2W6tAuBkN17RNALgZqdDXqpcQnA',
  { auth: { persistSession: false } }
);

async function checkSchema(schema) {
  try {
    const { data, error } = await db.schema(schema).from('parcel_tracking_events').select('*').limit(1);
    if (error) {
      console.log(`Schema: ${schema} -> Error: ${error.message} (code: ${error.code})`);
    } else {
      console.log(`Schema: ${schema} -> FOUND parcel_tracking_events! Data length: ${data.length}`);
    }
  } catch (err) {
    console.log(`Schema: ${schema} -> Exception: ${err.message}`);
  }
}

async function run() {
  const schemas = ['public', 'parcel', 'driver', 'routing', 'account', 'notifications', 'payment', 'reservation', 'parking_lot', 'partner'];
  for (const s of schemas) {
    await checkSchema(s);
  }
}

run();
