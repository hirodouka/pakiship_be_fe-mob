const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wgtnlhulpbsurodvkmbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndG5saHVscGJzdXJvZHZrbWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2NjM3OCwiZXhwIjoyMDkyOTQyMzc4fQ.7TE8HaDXiNzKHwyeW3JKjuwLVOhkkIQiXl52-faP_gw'
);

async function run() {
  const hubId = '4419c780-6025-4b1e-8c1c-dd0f3696f7d8'; // BGC High Street Hub
  
  const { data: selections, error } = await supabase
    .from("parcel_service_selections")
    .select("parcel_draft_id, parcel_drafts(*, parcel_draft_items(*))")
    .eq("hub_id", hubId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Selections count:', selections.length);
  if (selections.length > 0) {
    console.log('First Selection:', JSON.stringify(selections[0], null, 2));
    const draft = selections[0].parcel_drafts;
    console.log('Draft Status:', draft ? (Array.isArray(draft) ? draft[0].status : draft.status) : 'No draft');
  }
}
run();
