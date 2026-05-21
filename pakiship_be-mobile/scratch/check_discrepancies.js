require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.ts')) filelist.push(dirFile);
    }
  });
  return filelist;
}

async function main() {
  console.log("Analyzing codebase for expected schemas and tables...");
  const files = walkSync('./src');
  const expectedTables = new Set();
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // Match patterns like .schema("account").from("profiles") or just .from("driver_jobs")
    // Simplified regex
    const matches = content.matchAll(/(?:\.schema\(['"]([^'"]+)['"]\))?.*\.from\(['"]([^'"]+)['"]\)/g);
    for (const match of matches) {
      let schema = match[1] || 'public'; // Default to public if schema() isn't chained right before from()
      const table = match[2];
      
      // Specifically for the new routing change we did
      if (table === 'operator_earnings' || table === 'operator_incentives' || table === 'operator_hubs') {
        schema = 'routing';
      }
      
      // Some formatting cleanup
      if (schema === 'account' && table === 'customer_notifications') schema = 'notifications';
      if (schema === 'account' && table === 'notifications') schema = 'notifications';
      
      expectedTables.add(`${schema}.${table}`);
    }
  });

  console.log(`Found ${expectedTables.size} unique schema.table combinations in code.`);

  console.log("\nQuerying database for actual tables...");
  const { data: dbTables, error } = await supabase.rpc('get_raw_sql', {
    sql_query: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'parcel', 'driver', 'account', 'notifications', 'routing');`
  });

  if (error) {
    // If RPC fails, we'll use PostgREST fallback
    console.log("RPC failed (probably disabled). Checking tables individually...");
    for (const expected of expectedTables) {
      const [schema, table] = expected.split('.');
      const { error: tblError } = await supabase.schema(schema).from(table).select('*').limit(1);
      if (tblError && tblError.code === '42P01') {
        console.log(`❌ DISCREPANCY: Backend code expects ${schema}.${table}, but it DOES NOT EXIST in the database!`);
      } else if (tblError && tblError.message.includes('permission')) {
        console.log(`⚠️ PERMISSION ISSUE: ${schema}.${table} exists but has permission errors: ${tblError.message}`);
      } else {
        // Table exists and is queryable
      }
    }
  } else {
    const actualTables = new Set(dbTables.map(t => `${t.table_schema}.${t.table_name}`));
    for (const expected of expectedTables) {
      if (!actualTables.has(expected)) {
        console.log(`❌ DISCREPANCY: Backend code expects ${expected}, but it DOES NOT EXIST in the database!`);
      }
    }
  }
  
  console.log("\nDiscrepancy check complete.");
}

main();
