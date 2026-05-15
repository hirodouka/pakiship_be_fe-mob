import { useState, useMemo } from "react";
import type { Parcel } from "../types/parcel";

export type FilterType = "all" | "incoming" | "stored";

export function useParcelFilters(parcels: Parcel[]) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return parcels;
    return parcels.filter((p) => p.status === filter);
  }, [parcels, filter]);

  const counts = useMemo(() => ({
    all: parcels.length,
    incoming: parcels.filter((p) => p.status === "incoming").length,
    stored: parcels.filter((p) => p.status === "stored").length,
  }), [parcels]);

  return { filter, setFilter, filtered, counts };
}
