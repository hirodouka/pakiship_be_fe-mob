const axios = require('c:\\Users\\Bopbopgurl\\Downloads\\pakiship-updates-update\\pakiship-updates-update\\pakiship_be-mobile\\node_modules\\axios');

const supabaseUrl = 'https://rregfrhtlmfktliijzpd.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZWdmcmh0bG1ma3RsaWlqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MDM1MSwiZXhwIjoyMDg2OTY2MzUxfQ.9rYx4nZkF_K278AZ2W6tAuBkN17RNALgZqdDXqpcQnA';

async function checkSchema(schema) {
  try {
    const res = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept-Profile': schema
      }
    });
    const paths = Object.keys(res.data.paths || {});
    console.log(`=== Schema: ${schema} ===`);
    console.log(paths);
  } catch (err) {
    console.error(`Error for ${schema}:`, err.message);
  }
}

async function run() {
  const schemas = ['driver', 'routing', 'account', 'notifications', 'payment', 'reservation', 'parking_lot', 'partner'];
  for (const s of schemas) {
    await checkSchema(s);
  }
}

run();
