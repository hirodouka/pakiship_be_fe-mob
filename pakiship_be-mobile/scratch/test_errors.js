require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Testing manual in-memory join for parcel_drafts...');
  const res1 = await supabase
    .schema("parcel")
    .from("parcel_drafts")
    .select(`
      id,
      tracking_number,
      status
    `)
    .limit(2);
  
  if (res1.error) {
    console.error('parcel_drafts Error:', res1.error);
  } else {
    const draftIds = res1.data.map(d => d.id);
    const resItems = await supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .select("id, parcel_draft_id, item_type")
      .in("parcel_draft_id", draftIds);
    
    if (resItems.error) {
      console.error('parcel_draft_items Error:', resItems.error);
    } else {
      const joined = res1.data.map(draft => ({
        ...draft,
        parcel_draft_items: resItems.data.filter(item => item.parcel_draft_id === draft.id)
      }));
      console.log('Manual join Success. Joined data:', JSON.stringify(joined, null, 2));
    }
  }

  console.log('Testing parcel_reviews query...');
  const res2 = await supabase
    .schema("parcel")
    .from("parcel_reviews")
    .select('*')
    .limit(2);

  if (res2.error) {
    console.error('parcel_reviews Error:', res2.error);
  } else {
    console.log('parcel_reviews Success. Found:', res2.data.length, 'records.');
  }
}

main();
