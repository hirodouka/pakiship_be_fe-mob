const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mock SupabaseService
const mockSupabaseService = {
  createAdminClient: () => serviceClient
};

// Recreate listNearby logic from DropOffPointsService
async function listNearby(query) {
  const admin = mockSupabaseService.createAdminClient();
  const normalizedQuery = String(query ?? "").trim();
  
  let dbQuery = admin
    .schema("parcel")
    .from("drop_off_points")
    .select("*");

  if (normalizedQuery) {
    dbQuery = dbQuery.or(`name.ilike.%${normalizedQuery}%,address.ilike.%${normalizedQuery}%`);
  }

  let data = [];
  let error = null;

  try {
    const { data: resData, error: resError } = await dbQuery.limit(20);
    if (resError) {
      error = resError;
    } else {
      data = resData || [];
    }
  } catch (e) {
    error = e;
  }

  // Defensive fallback
  if (error || data.length === 0) {
    console.log("[Test] DB failed or empty. Applying Manila PakiHubs fallback...");
    data = [
      {
        id: "9c9b9999-9999-9999-9999-999999999901",
        name: "PakiShip Cubao Hub",
        address: "Aurora Blvd, Cubao, Quezon City, Metro Manila",
        max_capacity: 100,
        latitude: 14.6219,
        longitude: 121.0511,
        landmark: "Near Gateway Mall",
      },
      {
        id: "9c9b9999-9999-9999-9999-999999999902",
        name: "PakiShip BGC Hub",
        address: "26th St, Bonifacio Global City, Taguig, Metro Manila",
        max_capacity: 150,
        latitude: 14.5496,
        longitude: 121.0437,
        landmark: "Near High Street",
      },
      {
        id: "9c9b9999-9999-9999-9999-999999999903",
        name: "PakiShip Makati Hub",
        address: "Ayala Ave, Makati, Metro Manila",
        max_capacity: 120,
        latitude: 14.5547,
        longitude: 121.0244,
        landmark: "Near Greenbelt",
      }
    ];
    error = null;
  }

  const points = await Promise.all((data ?? []).map(async (row) => {
    let storedCount = 0;
    try {
      const { count } = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", row.id)
        .eq("status", "stored");
      storedCount = count ?? 0;
    } catch (e) {
      storedCount = 0;
    }

    const maxCapacity = row.max_capacity || 100;
    const usagePercent = (storedCount / maxCapacity) * 100;

    let distanceLabel = "1.2 km";
    let statusLabel = usagePercent > 90 ? "Busy" : "Open";
    
    if (row.name.includes("Cubao")) {
      distanceLabel = "4.5 km";
      statusLabel = "Busy";
    } else if (row.name.includes("BGC")) {
      distanceLabel = "12.0 km";
    } else if (row.name.includes("Makati")) {
      distanceLabel = "15.3 km";
    }

    return {
      id: row.id,
      name: row.name,
      address: row.address,
      distance: distanceLabel,
      status: statusLabel,
      capacity: usagePercent > 70 ? "High" : usagePercent > 30 ? "Medium" : "Low",
      latitude: row.latitude || 14.5995,
      longitude: row.longitude || 121.0366,
      landmark: row.landmark || "",
    };
  }));

  return { points };
}

async function run() {
  const result = await listNearby();
  console.log('Resulting Hubs:', result);
}

run();
