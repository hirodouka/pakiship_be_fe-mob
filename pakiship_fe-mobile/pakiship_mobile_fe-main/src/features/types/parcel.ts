export type ParcelStatus = "incoming" | "stored" | "picked_up";
export type PackageSize = "Small" | "Medium" | "Large";

export interface Parcel {
  id: string;
  trackingNumber: string;
  shelf: string;
  from: string;
  to: string;
  arrivedAt: string;
  status: ParcelStatus;
}

export interface PendingParcel {
  id: string;
  trackingNumber: string;
  size: PackageSize;
  to: string;
  from: string;
  expectedTime: string;
  status: "pending" | "processing" | "received";
}

export interface ReceivedParcel {
  id: string;
  trackingNumber: string;
  size: PackageSize;
  to: string;
  from: string;
  receivedTime: string;
}
