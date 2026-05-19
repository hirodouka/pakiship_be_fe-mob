import { apiRequest } from "../../services/api";

// ─── Hub ────────────────────────────────────────────────────────────────────

export async function fetchHubSummary() {
  return apiRequest("/pakiship/mobile/operator/hub-summary");
}

// ─── Parcels / Inventory ────────────────────────────────────────────────────

/** All parcels at this operator's hub (incoming, stored, picked-up, dispatched) */
export async function fetchPendingParcels(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return apiRequest(`/pakiship/mobile/operator/pending-parcels${qs}`);
}

/** Register a parcel drop-off by tracking number (manual entry) */
export async function registerManualEntry(trackingNumber: string) {
  return apiRequest("/pakiship/mobile/operator/manual-entry", {
    method: "POST",
    body: JSON.stringify({ trackingNumber }),
  });
}

/** Scan a QR code from the web operator dashboard to receive a parcel */
export async function scanQrCode(qrPayload: string) {
  return apiRequest("/pakiship/mobile/operator/scan-qr", {
    method: "POST",
    body: JSON.stringify({ qrPayload }),
  });
}

/** Update operator profile fields (name, email, phone) */
export async function updateOperatorProfile(fields: { fullName?: string; email?: string; phone?: string }) {
  return apiRequest("/pakiship/mobile/operator/profile", {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

/** List all available hubs */
export async function fetchAvailableHubs() {
  return apiRequest("/pakiship/mobile/operator/hubs");
}

/** Change the operator's active hub assignment */
export async function changeHubAssignment(hubId: string) {
  return apiRequest("/pakiship/mobile/operator/hub-assignment", {
    method: "PATCH",
    body: JSON.stringify({ hubId }),
  });
}

/** Mark a hub record as stored (receive parcel) — optionally set storage location */
export async function receiveParcel(recordId: string, storageLocation?: string) {
  return apiRequest(`/pakiship/mobile/operator/receive/${recordId}`, {
    method: "POST",
    body: JSON.stringify({ storageLocation }),
  });
}

/** Update a parcel hub record status: incoming | stored | picked-up | dispatched */
export async function updateParcelStatus(recordId: string, status: string) {
  return apiRequest(`/operator/dashboard/parcel-records/${recordId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Dispatch a stored parcel to a driver (creates a driver_jobs record) */
export async function dispatchParcel(recordId: string) {
  return apiRequest(`/pakiship/mobile/operator/dispatch/${recordId}`, {
    method: "POST",
  });
}

/** Mark a parcel as picked up directly by the customer at the hub */
export async function markPickedUp(recordId: string) {
  return apiRequest(`/pakiship/mobile/operator/parcel-records/${recordId}/pickup`, {
    method: "PATCH",
  });
}

/** Report a lost parcel */
export async function reportLostParcel(trackingNumber: string, details: string) {
  return apiRequest("/operator/dashboard/reports/lost-parcel", {
    method: "POST",
    body: JSON.stringify({ trackingNumber, details }),
  });
}

// ─── Relay bookings (PakiShare) ─────────────────────────────────────────────

export async function fetchRelayBookings() {
  return apiRequest("/operator/dashboard/relay-bookings");
}

// ─── Earnings ───────────────────────────────────────────────────────────────

/** period: "today" | "week" | "month" */
export async function fetchEarnings(period: "today" | "week" | "month" = "month") {
  return apiRequest(`/pakiship/mobile/operator/earnings?period=${period}`);
}

export async function fetchIncentives() {
  return apiRequest("/pakiship/mobile/operator/incentives");
}
