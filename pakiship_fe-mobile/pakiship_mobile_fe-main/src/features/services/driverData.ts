export type JobStatus = 'available' | 'in-progress' | 'completed';

export type DriverJob = {
  id: string;
  tag: string;
  size: 'Small' | 'Medium' | 'Large';
  eta?: string;
  pickup: string;
  dropoff: string;
  distance: string;
  customer: string;
  customerPhone?: string;
  earnings: string;
  status: JobStatus;
  packageDescription?: string;
  specialInstructions?: string;
};

export const jobs: DriverJob[] = [
  {
    id: '1',
    tag: 'JOB-2026-5647',
    size: 'Small',
    eta: '30 mins',
    pickup: 'BGC, Taguig City',
    dropoff: 'Makati Avenue, Makati',
    distance: '3.2 km',
    customer: 'Maria Santos',
    customerPhone: '+63 912 345 6789',
    earnings: 'P85',
    status: 'available',
    packageDescription: 'Documents and papers',
    specialInstructions: 'Please handle with care. Ring doorbell twice.',
  },
  {
    id: '2',
    tag: 'JOB-2026-5648',
    size: 'Medium',
    eta: '25 mins',
    pickup: 'SM Megamall, Mandaluyong',
    dropoff: 'Ortigas Center, Pasig',
    distance: '2.8 km',
    customer: 'Juan Reyes',
    customerPhone: '+63 917 234 5678',
    earnings: 'P120',
    status: 'in-progress',
    packageDescription: 'Electronics - Laptop',
    specialInstructions: 'Fragile item. Call upon arrival.',
  },
  {
    id: '3',
    tag: 'JOB-2026-5645',
    size: 'Small',
    pickup: 'Quezon City Hall',
    dropoff: 'UP Diliman, QC',
    distance: '4.5 km',
    customer: 'Anna Cruz',
    customerPhone: '+63 915 876 5432',
    earnings: 'P95',
    status: 'completed',
    packageDescription: 'Books and stationery',
    specialInstructions: 'Leave at security desk if not home.',
  },
];
