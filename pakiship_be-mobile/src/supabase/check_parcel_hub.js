const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wgtnlhulpbsurodvkmbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndG5saHVscGJzdXJvZHZrbWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2NjM3OCwiZXhwIjoyMDkyOTQyMzc4fQ.7TE8HaDXiNzKHwyeW3JKjuwLVOhkkIQiXl52-faP_gw'
);

async function run() {
  const trackingNumber = 'PKS-2026-218718';
  
  // Check the draft/parcel record
  const { data: parcel, error: parcelError } = await supabase
    .from('parcel_drafts')
    .select('*')
    .eq('tracking_number', trackingNumber)
    .single();

  if (parcelError) {
    console.error('Parcel Error:', parcelError);
    return;
  }

  console.log('Parcel Details:', JSON.stringify(parcel, null, 2));

  // Check the service selection for this parcel
  const { data: selection, error: selectionError } = await supabase
    .from('parcel_service_selections')
    .select('*')
    .eq('parcel_draft_id', parcel.id)
    .maybeSingle();

  if (selectionError) console.error('Selection Error:', selectionError);
  else console.log('Service Selection:', JSON.stringify(selection, null, 2));

  // Check hub records
  const { data: hubRecords, error: hubError } = await supabase
    .from('parcel_hub_records')
    .select('*')
    .eq('parcel_id', parcel.id);
  
  if (hubError) console.error('Hub Records Error:', hubError);
  else console.log('Hub Records:', JSON.stringify(hubRecords, null, 2));
}
run();
