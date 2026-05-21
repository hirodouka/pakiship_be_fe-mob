require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Querying foreign keys for parcel_draft_items...');
  const { data, error } = await supabase.rpc('get_raw_sql', {
    sql_query: `
      SELECT
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'parcel'
        AND tc.table_name = 'parcel_draft_items';
    `
  });
  
  if (error) {
    // If get_raw_sql RPC doesn't exist, we can use a query using standard select from pg_catalog or query direct SQL
    console.error('RPC Error (will fallback to direct query if needed):', error.message);
    
    // Fallback: Query using supabase.from() is not possible directly for pg_catalog,
    // so let's try a direct query on table constraints via standard PostgREST if views are mapped,
    // or let's try to add the foreign key constraint directly if it's missing!
  } else {
    console.log('Foreign key results:', data);
  }
}

main();
