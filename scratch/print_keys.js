const { createClient } = require('c:\\Users\\Bopbopgurl\\Downloads\\pakiship-updates-update\\pakiship-updates-update\\pakiship_be-mobile\\node_modules\\@supabase\\supabase-js');

const db = createClient(
  'https://rregfrhtlmfktliijzpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZWdmcmh0bG1ma3RsaWlqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MDM1MSwiZXhwIjoyMDg2OTY2MzUxfQ.9rYx4nZkF_K278AZ2W6tAuBkN17RNALgZqdDXqpcQnA',
  { auth: { persistSession: false } }
);

async function run() {
  const { data, error } = await db.schema('public').from('parcel_drafts').select('*').limit(1).single();
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns of public.parcel_drafts:', Object.keys(data));
  }
}

run();
