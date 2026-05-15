const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wgtnlhulpbsurodvkmbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndG5saHVscGJzdXJvZHZrbWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2NjM3OCwiZXhwIjoyMDkyOTQyMzc4fQ.7TE8HaDXiNzKHwyeW3JKjuwLVOhkkIQiXl52-faP_gw'
);

async function run() {
  const trackingNumber = 'PKS-2026-218718';
  const realHubId = '4419c780-6025-4b1e-8c1c-dd0f3696f7d8'; // BGC High Street Hub

  // 1. Find the parcel ID
  const { data: parcel } = await supabase
    .from('parcel_drafts')
    .select('id')
    .eq('tracking_number', trackingNumber)
    .single();

  if (!parcel) {
    console.error('Parcel not found');
    return;
  }

  // 2. Update service selection
  const { error: updateError } = await supabase
    .from('parcel_service_selections')
    .update({ hub_id: realHubId })
    .eq('parcel_draft_id', parcel.id);

  if (updateError) {
    console.error('Update Error:', updateError);
  } else {
    console.log('Successfully updated parcel hub assignment to real UUID!');
  }
}
run();
