import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

type DropOffPoint = {
  id: string;
  name: string;
  address: string;
  distance?: string;
  status?: string;
  capacity?: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
};

@Injectable()
export class DropOffPointsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listNearby(query?: string) {
    const admin = this.supabaseService.createAdminClient();
    const normalizedQuery = String(query ?? "").trim();
    
    let dbQuery = admin
      .schema("parcel")
      .from("drop_off_points")
      .select("*");

    if (normalizedQuery) {
      dbQuery = dbQuery.or(`name.ilike.%${normalizedQuery}%,address.ilike.%${normalizedQuery}%`);
    }

    const { data, error } = await dbQuery.limit(20);

    if (error) {
      console.error("[DropOffPoints] DB Error:", error);
      throw new InternalServerErrorException("Unable to load drop-off points.");
    }

    // Map DB rows to the expected frontend structure
    const points = await Promise.all((data ?? []).map(async (row) => {
      // Get current storage count
      const { count } = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", row.id)
        .eq("status", "stored");

      const storedCount = count ?? 0;
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

    return {
      points,
      meta: {
        source: "Supabase database",
        count: points.length,
      },
    };
  }
}

