const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const admin = serviceClient;
  
  let dbQuery = admin
    .schema("routing")
    .from("operator_hubs")
    .select("id, name, address, lat, lng, storage_capacity, is_active")
    .eq("is_active", true);

  console.log("Querying operator_hubs...");
  const { data, error } = await dbQuery.limit(20);
  if (error) {
    console.error("Error querying operator_hubs:", error);
    return;
  }
  console.log("Found operator_hubs count:", data.length);

  const points = await Promise.all((data ?? []).map(async (row) => {
    let storedCount = 0;
    try {
      const { count, error: countErr } = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", row.id)
        .eq("status", "stored");
        
      if (countErr) {
        console.error(`Error querying parcel_hub_records for hub ${row.name}:`, countErr);
      }
      storedCount = count ?? 0;
    } catch (e) {
      console.error(`Exception querying parcel_hub_records for hub ${row.name}:`, e);
      storedCount = 0;
    }

    const maxCapacity = row.storage_capacity || 100;
    const usagePercent = (storedCount / maxCapacity) * 100;

    return {
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: Number(row.lat) || 14.5995,
      longitude: Number(row.lng) || 121.0366,
    };
  }));

  console.log("Successfully processed points:", points);
}

run();
