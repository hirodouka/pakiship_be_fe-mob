export type BaseProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  role: "customer" | "driver" | "operator";
  address: string | null;
  city: string | null;
  province: string | null;
  documents: string[];
  profilePhotoUrl: string | null;
  createdAt: string | null;
};

export type UpdateProfileInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  address?: string;
  city?: string;
  province?: string;
  documents?: string[];
  profilePhotoUrl?: string | null;
};
