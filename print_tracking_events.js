const { createClient } = require('c:\\Users\\Bopbopgurl\\Downloads\\pakiship-updates-update\\pakiship-updates-update\\pakiship_be-mobile\\node_modules\\@supabase\\supabase-js');

const db = createClient(
  'https://rregfrhtlmfktliijzpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZWdmcmh0bG1ma3RsaWlqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5MDM1MSwiZXhwIjoyMDg2OTY2MzUxfQ.9rYx4nZkF_K278AZ2W6tAuBkN17RNALgZqdDXqpcQnA',
  { auth: { persistSession: false } }
);

async function run() {
  const parcelDraftId = '58e3e70e-83a7-4e36-addb-7ab62490e712';
  console.log(`Querying location.parcel_tracking_events for parcel_draft_id: ${parcelDraftId}`);
  const { data, error } = await db.schema('location').from('parcel_tracking_events').select('*').eq('parcel_draft_id', parcelDraftId);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
