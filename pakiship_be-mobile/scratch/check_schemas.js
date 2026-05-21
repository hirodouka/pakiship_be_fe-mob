const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCatalog() {
  console.log('=== Checking PostgreSQL System Catalog ===');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Query all custom schemas
  const schemasQuery = `
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name;
  `;

  console.log('\n--- 1. Listing All Schemas ---');
  let { data: schemas, error: schemasError } = await supabase.schema("account").rpc("execute_sql", {
    sql: schemasQuery
  });

  if (schemasError) {
    console.error('Error fetching schemas:', schemasError.message);
  } else {
    console.log('Schemas found in database:');
    console.log(schemas);
  }

  // 2. Query all tables in the custom schemas
  const tablesQuery = `
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
    ORDER BY table_schema, table_name;
  `;

  console.log('\n--- 2. Listing All Tables in Custom Schemas ---');
  let { data: tables, error: tablesError } = await supabase.schema("account").rpc("execute_sql", {
    sql: tablesQuery
  });

  if (tablesError) {
    console.error('Error fetching tables:', tablesError.message);
  } else {
    console.log('Tables found in database:');
    console.log(tables);
  }
}

checkCatalog();
