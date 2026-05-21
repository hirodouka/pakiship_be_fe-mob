export interface CapacityData {
  label: string;
  location: string;
  percentage: number;
}

export interface EarningsData {
  totalEarned: string;
  weeklyGrowth: string;
  incentives: string;
  bonusCount: number;
}

export interface WeekStats {
  totalParcels: number;
  avgTime: string;
  customerVisits: number;
  revenue: string;
}
