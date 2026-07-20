// Local TypeScript types replacing Convex Doc<> generated types

export type NJ = {
  id: number;
  name: string;
  empId: string | null;
  department: string | null;
  location: string | null;
  email: string | null;
  designation: string | null;
  joinDate: string;
  managerId: string;
  currentPhase: "Orientation" | "Training" | "Field" | "Graduated";
  category: "Developed" | "Performer" | "Performance Falling" | "Non-Performer" | "Uncategorised";
  tenureMonths: number;
  isActive: boolean;
  teamId: string | null;
  claimedCorporates: number | null;
  nrFromCorporates: number | null;
  stpExtendedDays: number;
  stpWipMarked:    boolean | null;
  stpWipNote:      string | null;
  stpWipMarkedAt:  string | null;
  stpWipMarkedBy:  string | null;
  stpClosed:            boolean | null;
  stpClosedAt:          string | null;
  stpClosedBy:          string | null;
  managerHuddleDone:    boolean | null;
  managerHuddleDoneAt:  string | null;
  managerHuddleDoneBy:  string | null;
  stpMetricsDone:       boolean | null;
  stpMetricsDoneAt:     string | null;
  stpMetricsDoneBy:     string | null;
  hasPositiveNR:        boolean;
  pipStatus:            string | null;  // "PA" | "PIP" | null
  pipFirstSeenAt:       string | null;
};

export type NRRecord = {
  id: number;
  njId: number;
  month: number;
  year: number;
  nrValue: number;
  isPositive: boolean;
  source: string;
};

export type ROIRecord = {
  id: number;
  njId: number;
  weekStart: string;
  roiValue: number;
  colorCode: string;
  fromDate: string | null;
  toDate: string | null;
  leads: number | null;
  registrations: number | null;
  conversionRate: number | null;
};

export type QubitScore = {
  id: number;
  njId: number;
  date: string;
  score: number;
  category: string;
  recordingsCompleted: number;
};

export type Lead = {
  id: number;
  njId: number;
  leadId: string;
  allocatedDate: string;
  lastActionDate: string;
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost" | "Stale";
  tatHours: number;
  tatBreached: boolean;
  isSelfGen: boolean;
};

export type RCBClaim = {
  id: number;
  njId: number;
  corporateName: string;
  claimDate: string;
  status: "Pending" | "Approved" | "Rejected" | "Under Review";
  revenueLinked: number;
};

export type RCBSummary = {
  id: number;
  njId: number;
  claimedCorporates: number;
  nrFromCorporates: number;
  noOfClients: number | null;
  lastSyncAt: string;
};

export type PerformanceAlert = {
  id: number;
  njId: number;
  alertType: "PA" | "PIP" | "EXIT";
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type HuddleLog = {
  id: number;
  njId: number;
  date: string;
  type: "Daily" | "Weekly" | "Monthly" | "Ad-hoc";
  conductedBy: string;
  completed: boolean;
  notes: string | null;
  teamsEventId: string | null;
  isExtended: boolean;
};

export type Document = {
  id: number;
  title: string;
  category: string;
  description: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  linkUrl: string | null;
  uploadedBy: string;
  uploadedAt: string;
};

export type FAQ = {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  order: number | null;
  createdAt: string;
};

export type SyncLog = {
  id: number;
  module: string;
  lastSyncAt: string;
  status: "success" | "error" | "running";
  errorMessage: string | null;
  recordsProcessed: number | null;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer" | "nj";
  teamId: string | null;
  createdAt: string;
};

// ROI query result shape (used in ROI & Performance pages)
export type ROISummaryRow = {
  id: number;
  name: string;
  designation: string | null;
  tenureMonths: number;
  joinDate: string;
  managerId: string;
  totalNR: number | null;
};

// Performance query result shape
export type PerformanceRow = {
  id: number;
  name: string;
  designation: string | null;
  joinDate: string;
  tenureMonths: number;
  category: string;
  nrStatus: "Positive" | "Negative" | null;
  nrPositiveMonth: number | null;
  roiStatus: "Positive" | "Negative" | null;
  claimedCorporates: number;
};

// RCB summary row (with NJ info joined)
export type RCBRow = {
  id: number;
  empId: string | null;
  name: string;
  designation: string | null;
  tenureMonths: number;
  joinDate: string;
  claimedCorporates: number;
  nrFromCorporates: number;
};

// Monthly NR grid
export type MonthlyGridData = {
  records: NRRecord[];
  months: string[];
};

// NRD stats
export type NRDStats = {
  totalPositive: number;
  totalNegative: number;
  positiveWithin4: number;
  negativeAfter4: number;
};
