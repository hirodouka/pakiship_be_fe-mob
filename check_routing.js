const axios = require('c:\\Users\\Bopbopgurl\\Downloads\\pakiship-updates-update\\pakiship-updates-update\\pakiship_be-mobile\\node_modules\\axios');

const supabaseUrl = 'https://rregfrhtlmfktliijzpd.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZWdmcmh0bG1ma3RsaWlqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MDM1MSwiZXhwIjoyMDg2OTY2MzUxfQ.9rYx4nZkF_K278AZ2W6tAuBkN17RNALgZqdDXqpcQnA';

async function run() {
  try {
    const res = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept-Profile': 'routing'
      }
    });
    console.log('=== Schema: routing ===');
    console.log(Object.keys(res.data.paths || {}).map(p => p.replace('/', '')));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
