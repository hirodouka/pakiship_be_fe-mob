const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Bopbopgurl/Downloads/pakiship_be_fe-main/pakiship_be_fe-main/pakiship_be-mobile/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHubs() {
  console.log('--- Checking drop_off_points ---');
  const { data, error } = await supabase
    .schema('parcel')
    .from('drop_off_points')
    .select('*');

  if (error) {
    console.error('Error fetching hubs:', error);
  } else {
    console.log('Hubs:', data);
  }
}

checkHubs();
