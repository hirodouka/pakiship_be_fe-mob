import { createContext, useContext, useState, ReactNode } from "react";

export type JobStatus = "available" | "in-progress" | "completed";
export type DeliveryType = "direct" | "relay";

export interface Job {
  id: string;
  jobNumber: string;
  pickup: string;
  dropoff: string;
  distance: string;
  earnings: string;
  status: JobStatus;
  customerName: string;
  packageSize: "Small" | "Medium" | "Large";
  timeLimit?: string;
  customerPhone?: string;
  packageDescription?: string;
  specialInstructions?: string;
  deliveryType?: DeliveryType;
  dropOffPoint?: string;
  qrCode?: string;
}

const initialJobs: Job[] = [
  {
    id: "1",
    jobNumber: "JOB-2026-5647",
    pickup: "BGC, Taguig City",
    dropoff: "Makati Avenue, Makati",
    distance: "3.2 km",
    earnings: "₱85",
    status: "available",
    customerName: "Maria Santos",
    packageSize: "Small",
    timeLimit: "30 mins",
    customerPhone: "+63 912 345 6789",
    packageDescription: "Documents and papers",
    specialInstructions: "Please handle with care. Ring doorbell twice.",
    deliveryType: "direct",
  },
  {
    id: "2",
    jobNumber: "JOB-2026-5648",
    pickup: "SM Megamall, Mandaluyong",
    dropoff: "Ortigas Center, Pasig",
    distance: "2.8 km",
    earnings: "₱120",
    status: "in-progress",
    customerName: "Juan Reyes",
    packageSize: "Medium",
    timeLimit: "25 mins",
    customerPhone: "+63 917 234 5678",
    packageDescription: "Electronics - Laptop",
    specialInstructions: "Fragile item. Call upon arrival.",
    deliveryType: "direct",
  },
  {
    id: "3",
    jobNumber: "JOB-2026-5645",
    pickup: "Quezon City Hall",
    dropoff: "UP Diliman, QC",
    distance: "4.5 km",
    earnings: "₱95",
    status: "completed",
    customerName: "Anna Cruz",
    packageSize: "Small",
    customerPhone: "+63 915 876 5432",
    packageDescription: "Books and stationery",
    specialInstructions: "Leave at security desk if not home.",
    deliveryType: "direct",
  },
  {
    id: "4",
    jobNumber: "R-2026-3401",
    pickup: "7-Eleven Frassati Gate",
    dropoff: "Mini Stop Commonwealth Ave",
    distance: "2.1 km",
    earnings: "₱65",
    status: "available",
    customerName: "Jose Garcia",
    packageSize: "Small",
    timeLimit: "20 mins",
    customerPhone: "+63 918 765 4321",
    packageDescription: "Clothing package",
    specialInstructions: "Scan QR code at pickup point to confirm.",
    deliveryType: "relay",
    dropOffPoint: "7-Eleven Frassati Gate",
    qrCode: "PKS-RELAY-3401",
  },
  {
    id: "5",
    jobNumber: "R-2026-3402",
    pickup: "FamilyMart Near Frassati",
    dropoff: "Sari-sari Store - Don Antonio St",
    distance: "1.8 km",
    earnings: "₱55",
    status: "available",
    customerName: "Lisa Mendoza",
    packageSize: "Small",
    timeLimit: "15 mins",
    customerPhone: "+63 919 876 5432",
    packageDescription: "Cosmetics and beauty items",
    specialInstructions: "Handle with care, fragile items inside.",
    deliveryType: "relay",
    dropOffPoint: "FamilyMart Near Frassati",
    qrCode: "PKS-RELAY-3402",
  },
  {
    id: "6",
    jobNumber: "R-2026-3403",
    pickup: "Alfamart Frassati Corner",
    dropoff: "Ministop - Batasan Road",
    distance: "3.5 km",
    earnings: "₱75",
    status: "available",
    customerName: "Mark Castillo",
    packageSize: "Medium",
    timeLimit: "25 mins",
    customerPhone: "+63 920 123 4567",
    packageDescription: "Books and magazines",
    specialInstructions: "Customer will show QR at pickup.",
    deliveryType: "relay",
    dropOffPoint: "Alfamart Frassati Corner",
    qrCode: "PKS-RELAY-3403",
  },
  {
    id: "7",
    jobNumber: "R-2026-3398",
    pickup: "7-Eleven Frassati Gate",
    dropoff: "FamilyMart Near Frassati",
    distance: "1.2 km",
    earnings: "₱50",
    status: "in-progress",
    customerName: "Rosa Martinez",
    packageSize: "Small",
    timeLimit: "15 mins",
    customerPhone: "+63 921 234 5678",
    packageDescription: "Snacks and beverages",
    specialInstructions: "Quick delivery, perishable items.",
    deliveryType: "relay",
    dropOffPoint: "7-Eleven Frassati Gate",
    qrCode: "PKS-RELAY-3398",
  },
  {
    id: "8",
    jobNumber: "R-2026-3395",
    pickup: "Mini Stop Commonwealth Ave",
    dropoff: "Alfamart Frassati Corner",
    distance: "2.3 km",
    earnings: "₱60",
    status: "completed",
    customerName: "Carlos Diaz",
    packageSize: "Medium",
    customerPhone: "+63 922 345 6789",
    packageDescription: "Office supplies",
    specialInstructions: "Package was picked up and delivered successfully.",
    deliveryType: "relay",
    dropOffPoint: "Mini Stop Commonwealth Ave",
    qrCode: "PKS-RELAY-3395",
  },
  {
    id: "9",
    jobNumber: "JOB-2026-5642",
    pickup: "Rockwell Center, Makati",
    dropoff: "Bonifacio Global City",
    distance: "2.9 km",
    earnings: "₱90",
    status: "completed",
    customerName: "Rachel Tan",
    packageSize: "Small",
    customerPhone: "+63 923 456 7890",
    packageDescription: "Important documents",
    specialInstructions: "Delivered to front desk.",
    deliveryType: "direct",
  },
];

interface JobsContextType {
  jobs: Job[];
  updateJobStatus: (jobId: string, newStatus: JobStatus) => void;
  addJob: (job: Job) => void;
}

const JobsContext = createContext<JobsContextType | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  const updateJobStatus = (jobId: string, newStatus: JobStatus) => {
    setJobs(prev =>
      prev.map(job => job.id === jobId ? { ...job, status: newStatus } : job)
    );
  };

  const addJob = (job: Job) => {
    setJobs(prev => [job, ...prev]);
  };

  return (
    <JobsContext.Provider value={{ jobs, updateJobStatus, addJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) throw new Error("useJobs must be used within a JobsProvider");
  return context;
}
