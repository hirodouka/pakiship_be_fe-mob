const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Bopbopgurl/Downloads/pakiship_be_fe-main/pakiship_be_fe-main/pakiship_be-mobile/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignAllOperators() {
  const hubId = 'bgc-taguig-hub-001';
  const hubName = 'BGC Taguig Hub';
  const hubAddress = 'BGC, Taguig City, Metro Manila';

  console.log('--- Ensuring default Hub exists ---');
  // 1. Ensure BGC Taguig Hub exists
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

  // 2. Fetch all operators from account.profiles
  console.log('--- Fetching all operator profiles ---');
  const { data: operators, error: opsError } = await supabase
    .schema('account')
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('role', 'operator');

  if (opsError) {
    console.error('Error fetching operator profiles:', opsError);
    return;
  }

  console.log(`Found ${operators.length} operators in the database:`);
  operators.forEach(op => console.log(`- ${op.full_name} (${op.email}) [ID: ${op.id}]`));

  if (operators.length === 0) {
    console.log('No operator profiles found. Please register or seed operators first.');
    return;
  }

  // 3. Process assignments for each operator
  console.log('--- Assigning all operators to default hub ---');
  for (const op of operators) {
    console.log(`Processing assignment for ${op.full_name}...`);

    // Deactivate existing assignments for this operator to prevent conflicts
    const { error: deactivateError } = await supabase
      .schema('parcel')
      .from('operator_hub_assignments')
      .update({ is_active: false })
      .eq('operator_user_id', op.id);

    if (deactivateError) {
      console.warn(`Warning deactivating old assignments for operator ${op.id}:`, deactivateError.message);
    }

    // Insert new active assignment to BGC Taguig Hub
    const { data: assignment, error: assignError } = await supabase
      .schema('parcel')
      .from('operator_hub_assignments')
      .upsert({
        operator_user_id: op.id,
        hub_id: hubId,
        is_active: true,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (assignError) {
      console.error(`Error assigning operator ${op.full_name} to hub:`, assignError);
    } else {
      console.log(`Successfully assigned ${op.full_name} to default hub. Assignment ID: ${assignment.id}`);
    }
  }

  console.log('--- Assignment processing complete ---');
}

assignAllOperators();
