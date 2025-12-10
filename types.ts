// types.ts

// --- CORE TYPES ---

export type JobStatus = 'Estimate Scheduled' | 'Quote Sent' | 'Scheduled' | 'In Progress' | 'Awaiting Parts' | 'Supplier Run' | 'Completed' | 'Paid' | 'Declined' | 'Job Created';

export const ALL_JOB_STATUSES: JobStatus[] = [
    'Job Created', 'Estimate Scheduled', 'Quote Sent', 'Scheduled', 'In Progress', 
    'Awaiting Parts', 'Supplier Run', 'Completed', 'Paid', 'Declined'
];

export const jobStatusColors: Record<JobStatus, { base: string, text: string }> = {
    'Job Created': { base: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200' },
    'Estimate Scheduled': { base: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-800 dark:text-slate-200' },
    'Quote Sent': { base: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-800 dark:text-orange-300' },
    'Scheduled': { base: 'bg-sky-100 dark:bg-sky-900/50', text: 'text-sky-800 dark:text-sky-300' },
    'In Progress': { base: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' },
    'Awaiting Parts': { base: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
    'Supplier Run': { base: 'bg-teal-100 dark:bg-teal-900/50', text: 'text-teal-800 dark:text-teal-300' },
    'Completed': { base: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
    'Paid': { base: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-800 dark:text-indigo-300' },
    'Declined': { base: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
};

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid_in_full';

export const paymentStatusColors: Record<PaymentStatus, { base: string, text: string }> = {
    'unpaid': { base: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
    'deposit_paid': { base: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' },
    'paid_in_full': { base: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
    'unpaid': 'Unpaid',
    'deposit_paid': 'Deposit Paid',
    'paid_in_full': 'Paid in Full',
};

export interface Part {
    id: string;
    name: string;
    cost: number;
    quantity: number;
}

export interface StatusHistoryEntry {
    id: string;
    status: JobStatus;
    timestamp: string; // ISO string
    notes?: string;
    duration?: number; // in minutes
}

export type InspectionStatus = 'Pass' | 'Fail' | 'Repaired' | 'N/A';

export interface InspectionItem {
    id: string;
    name: string;
    status?: InspectionStatus;
    notes?: string;
}

export const DEFAULT_INSPECTION_ITEMS: string[] = [
    'Photo Eyes',
    'Reversing Mechanism',
    'Emergency Release',
    'Door Balance',
    'Springs',
    'Cables',
    'Rollers',
    'Hinges',
    'Tracks',
    'Shaft, Drums & Bearings',
    'Pulleys & Sheaves',
    'Bottom Fixtures',
    'Door Panels/Sections',
    'Weather Seal',
    'Opener Motor & Drive',
    'Opener Travel Limits',
    'Wall Console / Button',
    'Remotes & Keypad',
    'Lubrication Status',
    'Warning Labels'
];

export interface SafetyInspection {
    id: string;
    name: string;
    items: InspectionItem[];
}

export interface JobTicket {
    id: string;
    createdAt: string; // ISO string
    jobLocation: string;
    jobLocationContactName?: string;
    jobLocationContactPhone?: string;
    statusHistory: StatusHistoryEntry[];
    paymentStatus?: PaymentStatus;
    notes: string;
    parts: Part[];
    laborCost: number;
    salesTaxRate?: number;
    processingFeeRate?: number;
    deposit?: number;
    inspections?: SafetyInspection[];
}

export interface FileAttachment {
    id: string;
    name: string;
    type: string;
    size: number;
    dataUrl: string; // Base64 data URL
}

export interface CustomField {
    id: string;
    label: string;
    value: string;
}

export type ContactMethod = 'Call' | 'Text' | 'Email';

export interface AdditionalContact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    label?: string; // e.g. Spouse, Tenant, Manager
    preferredMethod?: ContactMethod;
}

export interface Spring {
    id: string;
    size: string;
}

export interface DoorProfile {
    id: string;
    dimensions: string;
    doorType: string;
    springSystem: string;
    springs: Spring[];
    openerBrand: string;
    openerModel: string;
    doorInstallDate: string;
    springInstallDate: string;
    openerInstallDate: string;
    doorBrand?: string;
    doorModel?: string;
    doorColor?: string;
    doorPanelStyle?: string;
    doorNotes?: string;
}

export interface QuoteOption {
    id: string;
    name: string;
    description: string;
    parts: Part[];
    laborCost: number;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';

export interface Quote {
    id: string;
    quoteNumber: string;
    title: string;
    createdAt: string; // ISO string
    status: QuoteStatus;
    options: QuoteOption[];
    salesTaxRate: number;
    processingFeeRate: number;
    includeDeposit?: boolean;
}

export interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    photoUrl: string;
    files: FileAttachment[];
    customFields: CustomField[];
    additionalContacts?: AdditionalContact[];
    preferredMethod?: ContactMethod;
    jobTickets: JobTicket[];
    doorProfiles?: DoorProfile[];
    quotes?: Quote[];
    lastModified: string; // ISO string
    isPinned?: boolean;
}


// --- APP & SETTINGS ---

export interface DefaultFieldSetting {
    id: string;
    label: string;
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
    logoUrl?: string;
    logoDataUrl?: string;
    defaultSalesTaxRate?: number;
    defaultProcessingFeeRate?: number;
    onMyWayTemplate?: string;
    standardMileageRate?: number;
    suppliers?: Supplier[];
}

export interface EmailSettings {
    estimate: { subject: string; body: string };
    receipt: { subject: string; body: string };
}

export const DEFAULT_ON_MY_WAY_TEMPLATE = 'Hi {{customerName}}, this is {{businessName}}. Your technician is on their way!';
export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
    estimate: {
        subject: 'Your Estimate from {{businessName}} (Job #{{jobId}})',
        body: 'Hi {{customerName}},\n\nPlease find your estimate attached.\n\nThank you,\n{{businessName}}'
    },
    receipt: {
        subject: 'Your Receipt from {{businessName}} (Job #{{jobId}})',
        body: 'Hi {{customerName}},\n\nThank you for your business! Your receipt is attached.\n\n- {{businessName}}'
    }
};

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

export interface MapSettings {
    homeAddress: string;
    apiKey?: string;
}

export interface AiSettings {
    geminiApiKey?: string;
}

export type Theme = 'light' | 'dark' | 'system';

export type ViewState = 
    | { type: 'dashboard' }
    | { type: 'calendar' }
    | { type: 'route', initialDate?: string }
    | { type: 'expenses' }
    | { type: 'reports' }
    | { type: 'mileage' }
    | { type: 'social' }
    | { type: 'list' }
    | { type: 'detail', contactId: string, initialJobDate?: string, openJobId?: string }
    | { type: 'new_form', initialJobDate?: string }
    | { type: 'edit_form', contactId: string }
    | { type: 'settings' }
    | { type: 'invoice', contactId: string, ticketId: string, from: 'contact_detail' | 'job_detail' }
    | { type: 'job_detail', contactId: string, ticketId: string }
    | { type: 'quote_view'; contactId: string; quoteId: string; }
    | { type: 'quote_form'; contactId: string; quoteId?: string; };

// --- NOTIFICATIONS ---
export type NotificationType = 'success' | 'error' | 'info';

export interface AppNotification {
    id: string;
    message: string;
    type: NotificationType;
}

// --- FINANCE & MILEAGE ---
export type ExpenseCategory = 'Advertising' | 'Fuel' | 'Building Materials' | 'Tools & Equipment' | 'Office Supplies' | 'Meals & Entertainment' | 'Software' | 'Utilities' | 'Travel' | 'Bank & Processing Fee' | 'Mileage' | 'Other' | 'Uncategorized';
export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = ['Advertising', 'Fuel', 'Building Materials', 'Tools & Equipment', 'Office Supplies', 'Meals & Entertainment', 'Software', 'Utilities', 'Travel', 'Bank & Processing Fee', 'Mileage', 'Other', 'Uncategorized'];

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
    receiptUrl: string; // aistudio file URL or data URL
    receiptDataUrl?: string; // For local/guest mode
    receiptHash?: string;
    createdAt: string;
    isReconciled: boolean;
    bankTransactionIds?: string[];
    isDeferred?: boolean;
}

export interface BankTransaction {
    id: string;
    date: string; // YYYY-MM-DD
    description: string;
    amount: number;
    isReconciled: boolean;
    createdAt: string;
    statementId?: string;
    category?: ExpenseCategory;
}

export interface BankStatement {
    id: string;
    fileName: string;
    fileHash: string;
    uploadedAt: string;
    transactionCount: number;
    statementPeriod?: string;
}

export interface Mileage {
    id: string;
    date: string; // YYYY-MM-DD
    startAddress: string;
    endAddress: string;
    distance: number; // in miles
    notes?: string;
    jobId?: string;
    jobContactName?: string;
    createdAt: string;
    source?: 'manual' | 'route-planner';
    isManuallyEdited?: boolean;
}

// --- ROUTING ---
export type RouteStopType = 'home' | 'job' | 'supplier' | 'place';
export interface HomeStopData { address: string; label: 'Start' | 'End'; }
export interface JobStopData extends JobTicket {
    contactName: string;
    contactAddress: string;
    contactId: string;
    address: string;
    time?: string;
}
export interface PlaceStopData {
    name: string;
    address: string;
}
export type StopData = JobStopData | Supplier | HomeStopData | PlaceStopData;
export interface RouteStop {
    type: RouteStopType;
    id: string;
    data: StopData;
}
export interface SavedRouteStop {
    type: RouteStopType;
    id?: string; // for supplier
    label?: 'Start' | 'End'; // for home
    jobId?: string; // for job
    contactId?: string; // for job
    supplierId?: string; // for supplier
    placeName?: string; // for place
    placeAddress?: string; // for place
}
export interface RouteMetrics {
    travelTimeText: string;
    travelTimeValue: number;
    travelDistanceText: string;
    travelDistanceValue: number;
    eta: string;
    idleTime: number;
}
export interface CategorizationRule {
    id: string;
    keyword: string;
    category: ExpenseCategory;
}