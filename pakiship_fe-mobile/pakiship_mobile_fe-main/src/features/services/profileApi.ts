import { apiRequest } from './api';

export const profileApi = {
  getProfile: async () => {
    return apiRequest('/pakiship/mobile/customer/profile');
  },

  updateProfile: async (data: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    dob?: string;
    preferences?: Record<string, boolean>;
  }) => {
    return apiRequest('/pakiship/mobile/customer/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  uploadAvatar: async (formData: FormData) => {
    return apiRequest('/pakiship/mobile/customer/profile/upload-avatar', {
      method: 'POST',
      body: formData,
    });
  },

  changePassword: async (currentPassword: '', newPassword: '') => {
    return apiRequest('/pakiship/mobile/customer/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  
  googleMapsAutocomplete: async (query: string) => {
    return apiRequest(`/pakiship/mobile/customer/profile/maps/autocomplete?query=${encodeURIComponent(query)}`);
  },

  googleMapsDetails: async (placeId: string) => {
    return apiRequest(`/pakiship/mobile/customer/profile/maps/details?placeId=${placeId}`);
  },
};
