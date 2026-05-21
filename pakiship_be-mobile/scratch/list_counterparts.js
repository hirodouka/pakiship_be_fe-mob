require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const schemas = ['account', 'driver', 'location', 'notifications', 'parcel', 'routing'];
  
  console.log('Querying tables in exposed schemas...');
  
  for (const schema of schemas) {
    // Probing table names by querying the pg_catalog info or similar using direct queries or testing common table names
    console.log(`\n--- Schema: ${schema} ---`);
    
    // We can try to list common tables from our codebase or from the schema diagram
    let tablesToProbe = [];
    if (schema === 'account') {
      tablesToProbe = ['users', 'profiles', 'admin_accounts', 'customer_activity_logs', 'customer_announcements', 'customer_notifications', 'customer_reviews', 'customer_saved_recipients', 'document_verifications'];
    } else if (schema === 'driver') {
      tablesToProbe = ['driver_profiles', 'driver_jobs', 'driver_earnings', 'driver_sessions', 'driver_job_events'];
    } else if (schema === 'location') {
      tablesToProbe = ['drop_off_points', 'parcel_tracking_events', 'parcel_hub_records'];
    } else if (schema === 'notifications') {
      tablesToProbe = ['notifications', 'customer_notifications', 'announcements', 'customer_announcements'];
    } else if (schema === 'parcel') {
      tablesToProbe = ['parcel_drafts', 'parcel_draft_items', 'parcel_reviews', 'drop_off_points', 'parcel_hub_records', 'driver_jobs', 'parcel_service_selections'];
    } else if (schema === 'routing') {
      tablesToProbe = ['operator_hubs', 'operator_earnings', 'operator_incentives', 'operator_hub_assignments'];
    }
    
    for (const table of tablesToProbe) {
      const { data, error } = await supabase.schema(schema).from(table).select('id').limit(1);
      if (error) {
        if (error.message.includes("Could not find the table")) {
          // Table doesn't exist in this schema
        } else {
          console.log(`  [Exists] ${table} (Error: ${error.message})`);
        }
      } else {
        console.log(`  [Exists] ${table} - Found ${data.length} rows`);
      }
    }
  }
}

main();
