const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wgtnlhulpbsurodvkmbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndG5saHVscGJzdXJvZHZrbWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2NjM3OCwiZXhwIjoyMDkyOTQyMzc4fQ.7TE8HaDXiNzKHwyeW3JKjuwLVOhkkIQiXl52-faP_gw'
);

async function run() {
  const hubId = '4419c780-6025-4b1e-8c1c-dd0f3696f7d8';
  
  const { data: hubRows, error: hubError } = await supabase
    .from("parcel_hub_records")
    .select("*, parcel_drafts(*, parcel_draft_items(*))")
    .eq("hub_id", hubId);

  console.log('Hub Rows Count:', hubRows?.length || 0);
  if (hubRows?.length > 0) {
    console.log('First Hub Row Draft:', JSON.stringify(hubRows[0].parcel_drafts, null, 2));
  }
}
run();
