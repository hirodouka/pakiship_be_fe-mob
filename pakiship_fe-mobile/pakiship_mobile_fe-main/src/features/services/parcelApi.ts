import { apiRequest } from './api';

export interface LocationData {
  address: string;
  details?: string;
  lat?: number;
  lng?: number;
}

export interface ParcelItem {
  size: string;
  weight: string;
  itemType: string;
  deliveryGuarantee: string;
  quantity: number;
}

export const parcelApi = {
  getHubs: async (pickupLat?: number, pickupLng?: number) => {
    let url = '/parcel-drafts/hubs';
    if (pickupLat !== undefined && pickupLng !== undefined) {
      url += `?pickupLat=${pickupLat}&pickupLng=${pickupLng}`;
    }
    return apiRequest(url);
  },

  saveStep1: async (pickup: LocationData, delivery: LocationData, distance?: string, duration?: string, draftId?: string) => {
    return apiRequest('/parcel-drafts/step-1', {
      method: 'POST',
      body: JSON.stringify({
        draftId,
        pickupLocation: pickup,
        deliveryLocation: delivery,
        distance,
        duration,
      }),
    });
  },

  getRoute: async (origin: string, destination: string) => {
    return apiRequest('/parcel-drafts/get-route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  },

  reverseGeocode: async (lat: number, lng: number) => {
    return apiRequest('/parcel-drafts/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    });
  },

  addItems: async (draftId: string, items: ParcelItem[]) => {
    return apiRequest(`/parcel-drafts/${draftId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  selectService: async (draftId: string, serviceId: string, servicePrice: number, dropOffPoint?: any) => {
    return apiRequest(`/parcel-drafts/${draftId}/service`, {
      method: 'POST',
      body: JSON.stringify({
        serviceId,
        servicePrice,
        dropOffPoint,
      }),
    });
  },

  completeBooking: async (draftId: string, bookingData: {
    senderName: string;
    senderPhone: string;
    receiverName: string;
    receiverPhone: string;
    paymentMethod: string;
    selectedService: string;
    servicePrice: number;
    totalParcels: number;
    distance?: string;
    duration?: string;
    dropOffPoint?: any;
  }) => {
    return apiRequest(`/parcel-drafts/${draftId}/booking`, {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  getHistory: async () => {
    return apiRequest('/parcel-drafts/history');
  },

  getTrackingDetails: async (trackingNumber: string) => {
    return apiRequest(`/parcel-drafts/track/${trackingNumber}`);
  },
};
