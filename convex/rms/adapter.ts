/**
 * RMS Adapter Interface
 * Swap mockClient → liveClient at M0 when RMS API credentials are available.
 */

export interface NJRecord {
  empId: string;
  name: string;
  department: string;
  managerName: string;
  location: string;
  email: string;
  joinDate: string; // ISO date "YYYY-MM-DD"
  status: string;   // "Red" | "Yellow" | "Green"
  designation?: string;
  claimedCorporates?: number;
  nrFromCorporates?: number;
  totalNR?: number;           // "INR" column — pre-computed total NR from the sheet
}

export interface QubitRecord {
  njId: string;
  date: string;
  score: number;
  category: string;
  recordingsCompleted: number;
}

export interface LeadRecord {
  njId: string;
  leadId: string;
  allocatedDate: string;
  lastActionDate: string;
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost" | "Stale";
  tatHours: number;
  tatBreached: boolean;
  isSelfGen: boolean;
}

export interface NRRecord {
  njId: string;
  month: number;
  year: number;
  nrValue: number;
  isPositive: boolean;
  source: "RMS" | "Manual";
}

export interface ROIRecord {
  njId: string;
  weekStart: string;
  roiValue: number;
  colorCode: "Green" | "Black" | "Red" | "Yellow";
  // Fields from the updated live API
  fromDate?: string;
  toDate?: string;
  leads?: number;
  registrations?: number;
  conversionRate?: number;
}

export interface RCBRecord {
  njId: string;
  corporateName: string;
  claimDate: string;
  status: "Pending" | "Approved" | "Rejected" | "Under Review";
  revenueLinked: number;
}

export interface RMSClient {
  fetchNewJoiners(): Promise<NJRecord[]>;
  fetchQubits(): Promise<QubitRecord[]>;
  fetchLeads(): Promise<LeadRecord[]>;
  fetchNR(): Promise<NRRecord[]>;
  fetchROI(): Promise<ROIRecord[]>;
  fetchRCB(): Promise<RCBRecord[]>;
}
