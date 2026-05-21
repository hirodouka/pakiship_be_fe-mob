
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Bopbopgurl/Downloads/pakiship_be_fe-main/pakiship_be_fe-main/pakiship_be-mobile/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignJanella() {
  const janellaId = '9e6bb2cd-845d-4d0c-bad7-80800b6563c7';
  const hubId = 'bgc-taguig-hub-001';
  const hubName = 'BGC Taguig Hub';
  const hubAddress = 'BGC, Taguig City, Metro Manila';

  console.log('--- Assigning Janella to Hub ---');

  // 1. Ensure Hub exists
  const { data: hub, error: hubError } = await supabase
    .schema('parcel')
    .from('drop_off_points')
    .upsert({
      id: hubId,
      name: hubName,
      address: hubAddress,
      is_active: true,
      status: 'Open',
      max_capacity: 100
    })
    .select()
    .single();

  if (hubError) {
    console.error('Error creating/updating hub:', hubError);
    return;
  }
  console.log('Hub ensured:', hub.name);

  // 2. Deactivate any existing assignments for Janella
  const { error: deactivateError } = await supabase
    .schema('parcel')
    .from('operator_hub_assignments')
    .update({ is_active: false })
    .eq('operator_user_id', janellaId);

  if (deactivateError) {
    console.error('Error deactivating old assignments:', deactivateError);
  }

  // 3. Create new active assignment
  const { data: assignment, error: assignError } = await supabase
    .schema('parcel')
    .from('operator_hub_assignments')
    .upsert({
      operator_user_id: janellaId,
      hub_id: hubId,
      is_active: true,
      assigned_at: new Date().toISOString()
    })
    .select()
    .single();

  if (assignError) {
    console.error('Error assigning janella to hub:', assignError);
    return;
  }

  console.log('Successfully assigned Janella to', hubName);
  console.log('Assignment details:', assignment);
}

assignJanella();
