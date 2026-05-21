const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Bopbopgurl/Downloads/pakiship_be_fe-main/pakiship_be_fe-main/pakiship_be-mobile/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSelectionsColumns() {
  const { data: selections, error } = await supabase
    .schema('parcel')
    .from('parcel_service_selections')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching selections:', error);
    return;
  }

  console.log('Selections columns:', selections.length > 0 ? Object.keys(selections[0]) : 'No selections found');
  if (selections.length > 0) {
    console.log('First selection sample:', JSON.stringify(selections[0], null, 2));
  }
}

checkSelectionsColumns();
