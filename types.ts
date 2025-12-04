



export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl?: string; // Base64 encoded file content
  size: number;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface DefaultFieldSetting {
  id: string;
  label: string;
}

export interface Spring {
  id: string;
  size: string;
}

export interface DoorProfile {
  id: string;
  dimensions: string;
  doorType: string; // Sectional, One-piece, Rolling Steel
  springSystem: string; // Torsion, Extension
  springSize?: string; // e.g. .250x2x32 (Legacy, prefer springs array)
  springs?: Spring[]; 
  openerBrand: string;
  openerModel: string;
  doorInstallDate: string;   // YYYY-MM-DD, "Original", or "Unknown"
  springInstallDate: string; // YYYY-MM-DD, "Original", or "Unknown"
  openerInstallDate: string; // YYYY-MM-DD, "Original", or "Unknown"
}

export type JobStatus = 'Job Created' | 'Estimate Scheduled' | 'Quote Sent' | 'Scheduled' | 'In Progress' | 'Awaiting Parts' | 'Supplier Run' | 'Completed' | 'Paid' | 'Declined';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid_in_full';

export const jobStatusColors: Record<JobStatus, { base: string, text: string }> = {
  'Job Created': { base: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  'Estimate Scheduled': { base: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-200' },
  'Quote Sent': { base: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
  'Scheduled': { base: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-200' },
  'In Progress': { base: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
  'Awaiting Parts': { base: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
  'Supplier Run': { base: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
  'Completed': { base: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  'Paid': { base: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200' },
  'Declined': { base: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
};

export const paymentStatusColors: Record<PaymentStatus, { base: string, text: string }> = {
  'unpaid': { base: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
  'deposit_paid': { base: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-200' },
  'paid_in_full': { base: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
    'unpaid': 'Unpaid',
    'deposit_paid': 'Deposit Paid',
    'paid_in_full': 'Paid in Full',
};

export const ALL_JOB_STATUSES = Object.keys(jobStatusColors) as JobStatus[];

export interface Part {
  id: string;
  name: string;
  quantity: number;
  cost: number;
}

export type InspectionStatus = 'Pass' | 'Fail' | 'Repaired' | 'N/A';

export interface InspectionItem {
    id: string;
    name: string;
    status?: InspectionStatus;
    notes?: string;
}

export interface SafetyInspection {
  id: string;
  name: string;
  items: InspectionItem[];
}

export interface StatusHistoryEntry {
  id: string;
  status: JobStatus;
  timestamp: string; // ISO string
  notes?: string;
  duration?: number; // Estimated duration in minutes for this specific status
}

export interface JobTicket {
  id: string;
  jobLocation?: string; // Service address, defaults to contact address
  jobLocationContactName?: string; // Name of person at site if different from contact
  jobLocationContactPhone?: string; // Phone of person at site
  createdAt?: string; // ISO string
  statusHistory?: StatusHistoryEntry[];
  paymentStatus?: PaymentStatus;
  notes: string;
  parts: Part[];
  laborCost: number;
  salesTaxRate?: number;
  processingFeeRate?: number;
  deposit?: number;
  inspection?: InspectionItem[]; // Legacy: single inspection
  inspections?: SafetyInspection[]; // New: multiple inspections
}

export interface JobTemplate {
  id: string;
  name: string;
  notes: string;
  parts: Part[];
  laborCost: number;
  salesTaxRate?: number;
  processingFeeRate?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  defaultCost: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  photoUrl: string; // Can be a URL or a Base64 data URL
  files: FileAttachment[];
  customFields: CustomField[];
  jobTickets: JobTicket[];
  doorProfiles?: DoorProfile[];
  lastModified: string; // ISO string
  isPinned?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  address: string;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string; // Base64 data URL (guest) or HTTPS URL (cloud)
  logoDataUrl?: string; // Always a Base64 data URL, for PDF generation in cloud mode
  onMyWayTemplate?: string;
  defaultSalesTaxRate?: number;
  defaultProcessingFeeRate?: number;
  standardMileageRate?: number;
  suppliers?: Supplier[];
}

export interface MapSettings {
  apiKey: string;
  homeAddress: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailSettings {
  estimate: EmailTemplate;
  receipt: EmailTemplate;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  estimate: {
    subject: 'Estimate from {{businessName}} - Job #{{jobId}}',
    body: 'Hi {{customerName}},\n\nPlease find attached the estimate for the requested work.\n\nIf you have any questions, please let us know.\n\nThanks,\n{{businessName}}'
  },
  receipt: {
    subject: 'Receipt from {{businessName}} - Job #{{jobId}}',
    body: 'Hi {{customerName}},\n\nThank you for your business. Please find attached the receipt for Job #{{jobId}}.\n\nThanks,\n{{businessName}}'
  }
};

export const DEFAULT_ON_MY_WAY_TEMPLATE = "Hi {{customerName}}, this is {{businessName}}. I am on my way to service your garage door and should arrive in about 20 minutes.";

export const DEFAULT_INSPECTION_ITEMS = [
    "Door Balance / Operation",
    "Door Sections / Panels",
    "Hinges",
    "Rollers",
    "Vertical Track",
    "Horizontal Track",
    "Torsion / Extension Springs",
    "Cables",
    "Drums",
    "Center Bearing Plate",
    "End Bearing Plates",
    "Top Fixtures",
    "Bottom Fixtures",
    "Bottom Weather Seal",
    "Perimeter Weather Seal",
    "Struts / Trussing",
    "Opener Motor / Gear",
    "Opener Rail / Trolley",
    "Belt / Chain Tension",
    "Force Settings",
    "Limit Switches",
    "Safety Sensors (Photo Eyes)",
    "Auto-Reverse Safety Test",
    "Wall Button / Wiring",
    "Remotes / Keypad"
];

// --- EXPENSE TRACKING TYPES ---
export type ExpenseCategory = 
  | 'Advertising'
  | 'Office Supplies' 
  | 'Fuel' 
  | 'Building Materials' 
  | 'Meals & Entertainment' 
  | 'Tools & Equipment' 
  | 'Software' 
  | 'Utilities' 
  | 'Travel'
  | 'Bank & Processing Fee'
  | 'Mileage'
  | 'Uncategorized'
  | 'Other';

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = ['Advertising', 'Office Supplies', 'Fuel', 'Building Materials', 'Meals & Entertainment', 'Tools & Equipment', 'Software', 'Utilities', 'Travel', 'Bank & Processing Fee', 'Mileage', 'Other', 'Uncategorized'];

export interface ExpenseLineItem {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
}

export interface Expense {
  id: string;
  vendor: string;
  date: string; // YYYY-MM-DD
  total: number;
  tax: number;
  lineItems: ExpenseLineItem[];
  receiptUrl: string; // Base64 data URL (guest) or HTTPS URL (cloud)
  receiptDataUrl?: string; // Always a Base64 data URL, used for processing
  receiptHash?: string; // SHA-256 hash of the receipt file
  createdAt: string; // ISO string
  isReconciled: boolean;
  bankTransactionIds?: string[];
  isDeferred?: boolean;
}

export interface BankStatement {
    id: string;
    fileName: string;
    fileHash?: string; // SHA-256 hash of the statement file
    uploadedAt: string; // ISO String
    transactionCount: number;
    statementPeriod?: string; // e.g., "Oct 2025"
}

export interface BankTransaction {
    id: string;
    date: string; // YYYY-MM-DD
    description: string;
    amount: number; // Negative for debits, positive for credits
    isReconciled: boolean;
    createdAt: string; // ISO string
    statementId?: string; // Link to the source BankStatement
    category?: ExpenseCategory;
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  category: ExpenseCategory;
}

export interface Mileage {
  id: string;
  createdAt: string; // ISO string
  date: string; // YYYY-MM-DD
  startAddress: string;
  endAddress: string;
  distance: number; // in miles
  notes?: string;
  jobId?: string;
  jobContactName?: string;
  source?: 'route-planner' | 'manual';
  isManuallyEdited?: boolean;
}

export type SavedRouteStop =
  | { type: 'job'; jobId: string; contactId: string }
  | { type: 'home'; label: 'Start' | 'End' }
  | { type: 'supplier'; supplierId: string; id: string };

// --- ROUTE VIEW TYPES ---
export type JobStopData = JobTicket & { contactName: string; contactAddress: string; contactId: string; address: string; time?: string };
export type HomeStopData = { address: string; label: 'Start' | 'End' };

export type RouteStop =
    | { type: 'job'; id: string; data: JobStopData }
    | { type: 'home'; id: string; data: HomeStopData }
    | { type: 'supplier'; id: string; data: Supplier };

export interface RouteMetrics {
    travelTimeText: string;
    travelTimeValue: number; // seconds
    travelDistanceText: string;
    travelDistanceValue: number; // in meters
    eta: string; // Formatted time string
    idleTime: number; // in minutes
}

export type ViewState = 
  | { type: 'list' }
  | { type: 'detail'; id: string; initialJobDate?: string; openJobId?: string }
  | { type: 'new_form'; initialJobDate?: string }
  | { type: 'edit_form'; id: string }
  | { type: 'settings' }
  | { type: 'dashboard' }
  | { type: 'calendar' }
  | { type: 'route'; initialDate?: string }
  | { type: 'invoice'; contactId: string; ticketId: string; from?: 'contact_detail' | 'job_detail' }
  | { type: 'job_detail'; contactId: string; ticketId: string }
  | { type: 'expenses' }
  | { type: 'reports' }
  | { type: 'mileage' };

export type Theme = 'light' | 'dark' | 'system';