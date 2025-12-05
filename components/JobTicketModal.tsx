import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { JobTicket, JobStatus, Part, JobTemplate, ALL_JOB_STATUSES, CatalogItem, PaymentStatus, StatusHistoryEntry } from '../types.ts';
import { XIcon, PlusIcon, TrashIcon } from './icons.tsx';
import { generateId, calculateJobTicketTotal } from '../utils.ts';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

// Declare google for TS
declare const google: any;

// Helper to convert a UTC ISO string to a format suitable for datetime-local input
const getLocalDatetimeString = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Check for invalid date
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface JobTicketModalProps {
  entry?: JobTicket | null;
  onSave: (entry: Omit<JobTicket, 'id'> & { id?: string }) => void;
  onClose: () => void;
  jobTemplates?: JobTemplate[];
  partsCatalog?: CatalogItem[];
  enabledStatuses?: Record<JobStatus, boolean>;
  defaultSalesTaxRate?: number;
  defaultProcessingFeeRate?: number;
  contactAddress?: string;
  apiKey?: string;
}

const JobTicketModal: React.FC<JobTicketModalProps> = ({ entry, onSave, onClose, jobTemplates, partsCatalog, enabledStatuses, defaultSalesTaxRate, defaultProcessingFeeRate, contactAddress, apiKey }) => {
  const [jobLocation, setJobLocation] = useState('');
  const [jobLocationContactName, setJobLocationContactName] = useState('');
  const [jobLocationContactPhone, setJobLocationContactPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [notes, setNotes] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [laborCost, setLaborCost] = useState<number | ''>(0);
  const [salesTaxRate, setSalesTaxRate] = useState<number | ''>(0);
  const [processingFeeRate, setProcessingFeeRate] = useState<number | ''>(0);
  const [deposit, setDeposit] = useState<number | ''>(0);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);

  const [isTemplateConfirmOpen, setIsTemplateConfirmOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<string | null>(null);

  const locationInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(apiKey);

  useEffect(() => {
    if (entry) {
      setJobLocation(entry.jobLocation || '');
      setJobLocationContactName(entry.jobLocationContactName || '');
      setJobLocationContactPhone(entry.jobLocationContactPhone || '');
      setPaymentStatus(entry.paymentStatus || 'unpaid');
      setNotes(entry.notes);
      setParts(entry.parts.map(p => ({...p}))); // Create a copy to avoid direct mutation
      setLaborCost(entry.laborCost);
      setSalesTaxRate(entry.salesTaxRate || 0);
      setProcessingFeeRate(entry.processingFeeRate || 0);
      setDeposit(entry.deposit || 0);

      const history = entry.statusHistory && entry.statusHistory.length > 0
          ? [...entry.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [{ id: generateId(), status: 'Job Created' as JobStatus, timestamp: entry.createdAt || new Date().toISOString(), notes: 'Job created.' }];
      setStatusHistory(history);

    } else {
      setJobLocation(contactAddress || '');
      setJobLocationContactName('');
      setJobLocationContactPhone('');
      setPaymentStatus('unpaid');
      setNotes('');
      setParts([]);
      setLaborCost(0);
      setSalesTaxRate(defaultSalesTaxRate || 0);
      setProcessingFeeRate(defaultProcessingFeeRate || 0);
      setDeposit(0);

      setStatusHistory([{
          id: generateId(),
          status: 'Estimate Scheduled',
          timestamp: new Date().toISOString(),
          notes: 'Job created.'
      }]);
    }
  }, [entry, defaultSalesTaxRate, defaultProcessingFeeRate, contactAddress]);

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    if (isMapsLoaded && locationInputRef.current && (window as any).google && (window as any).google.maps) {
        const autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
        });
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                setJobLocation(place.formatted_address);
            } else if (place.name) {
                setJobLocation(place.name);
            }
        });
    }
  }, [isMapsLoaded]);

  // Focus trap for accessibility
  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
          if (e.shiftKey) { // Shift+Tab
              if (document.activeElement === firstElement) {
                  lastElement.focus();
                  e.preventDefault();
              }
          } else { // Tab
              if (document.activeElement === lastElement) {
                  firstElement.focus();
                  e.preventDefault();
              }
          }
      } else if (e.key === 'Escape') {
          onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleAddPart = () => {
    setParts([...parts, { id: generateId(), name: '', cost: 0, quantity: 1 }]);
  };

  const handlePartChange = (id: string, field: 'name' | 'cost' | 'quantity', value: string | number) => {
    const isNumeric = field === 'cost' || field === 'quantity';
    const parsedValue = isNumeric
        ? (field === 'quantity' ? Math.max(1, parseInt(value as string, 10) || 1) : parseFloat(value as string) || 0)
        : value;
    setParts(parts.map(p => p.id === id ? { ...p, [field]: parsedValue } : p));
  };

  const handleRemovePart = (id: string) => {
    setParts(parts.filter(p => p.id !== id));
  };
  
  const applyTemplate = () => {
    if (!templateToApply) return;
    const selectedTemplate = jobTemplates?.find(t => t.id === templateToApply);
    if (selectedTemplate) {
        setNotes(selectedTemplate.notes);
        setParts(selectedTemplate.parts.map(p => ({...p, id: generateId()})));
        setLaborCost(selectedTemplate.laborCost);
        setSalesTaxRate(selectedTemplate.salesTaxRate || defaultSalesTaxRate || 0);
        setProcessingFeeRate(selectedTemplate.processingFeeRate || defaultProcessingFeeRate || 0);
    }
    setIsTemplateConfirmOpen(false);
    setTemplateToApply(null);
  };
  
  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) return;
    const isDataEntered = notes || parts.length > 0 || Number(laborCost || 0) > 0;

    if (isDataEntered) {
        setTemplateToApply(templateId);
        setIsTemplateConfirmOpen(true);
    } else {
        const selectedTemplate = jobTemplates?.find(t => t.id === templateId);
        if (selectedTemplate) {
            setNotes(selectedTemplate.notes);
            setParts(selectedTemplate.parts.map(p => ({...p, id: generateId()})));
            setLaborCost(selectedTemplate.laborCost);
            setSalesTaxRate(selectedTemplate.salesTaxRate || defaultSalesTaxRate || 0);
            setProcessingFeeRate(selectedTemplate.processingFeeRate || defaultProcessingFeeRate || 0);
        }
    }
  };
  
  const handleQuickAddPart = (catalogItemId: string) => {
      const item = partsCatalog?.find(i => i.id === catalogItemId);
      if (item) {
          setParts([...parts, { id: generateId(), name: item.name, cost: item.defaultCost, quantity: 1 }]);
      }
  };

    const handleCalculate30PercentDeposit = useCallback(() => {
        // We need to calculate the total cost based on current state, *without* considering any existing deposit.
        const { totalCost: currentTotal } = calculateJobTicketTotal({
            parts,
            laborCost: Number(laborCost || 0),
            salesTaxRate: Number(salesTaxRate || 0),
            processingFeeRate: Number(processingFeeRate || 0),
        });
    
        const thirtyPercent = currentTotal * 0.30;
        // Round to 2 decimal places
        setDeposit(parseFloat(thirtyPercent.toFixed(2)));
    }, [parts, laborCost, salesTaxRate, processingFeeRate]);

  const handleHistoryChange = (id: string, field: keyof StatusHistoryEntry, value: string | number | undefined) => {
    setStatusHistory(prev => prev.map(item => {
        if (item.id === id) {
            const updatedItem = { ...item };
            if (field === 'timestamp') {
                updatedItem.timestamp = new Date(value as string).toISOString();
            } else if (field === 'duration') {
                const numValue = (value != null && String(value) !== '') ? Number(value) : undefined;
                if (numValue === undefined || isNaN(numValue)) {
                    delete updatedItem.duration; // Remove the key if value is empty/invalid
                } else {
                    updatedItem.duration = numValue;
                }
            } else {
                // For status and notes
                (updatedItem as any)[field] = value;
            }
            return updatedItem;
        }
        return item;
    }));
  };

  const addHistoryEntry = () => {
      const newEntry: StatusHistoryEntry = {
          id: generateId(),
          status: statusHistory[0]?.status || 'Scheduled', // Get status from the newest entry
          timestamp: new Date().toISOString(),
          notes: '',
      };
      // Add new entry and re-sort descending to ensure it's at the top.
      setStatusHistory(prev => [...prev, newEntry].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const deleteHistoryEntry = (id: string) => {
    if (statusHistory.length > 1) {
      setStatusHistory(prev => prev.filter(item => item.id !== id));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // The statusHistory state is already up-to-date from handleHistoryChange.
    // We just need to ensure it's sorted correctly before saving.
    const finalHistory = [...statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const savedEntry: Omit<JobTicket, 'id'> & { id?: string } = {
        id: entry?.id,
        createdAt: entry?.createdAt || new Date().toISOString(),
        jobLocation,
        jobLocationContactName,
        jobLocationContactPhone,
        statusHistory: finalHistory,
        paymentStatus,
        notes,
        parts,
        laborCost: Number(laborCost || 0),
        salesTaxRate: Number(salesTaxRate || 0),
        processingFeeRate: Number(processingFeeRate || 0),
        deposit: Number(deposit || 0),
    };
    onSave(savedEntry);
  };
  
  const visibleStatuses = useMemo(() => {
    if (!enabledStatuses) return ALL_JOB_STATUSES;
    return ALL_JOB_STATUSES.filter(s => enabledStatuses[s]);
  }, [enabledStatuses]);
  
  const { totalCost, balanceDue } = calculateJobTicketTotal({
    ...entry, notes, parts,
    laborCost: Number(laborCost || 0),
    salesTaxRate: Number(salesTaxRate || 0),
    processingFeeRate: Number(processingFeeRate || 0),
    deposit: Number(deposit || 0),
    id: entry?.id || '',
  });

  const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
  const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div ref={modalRef} className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
          <div className="p-6 border-b dark:border-slate-700 flex-shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{entry ? 'Edit Job' : 'New Job'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {entry ? `Job ID: ${entry.id}` : 'A new job will be created.'}
                </p>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-grow min-h-0">
            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                    <label htmlFor="jobLocation" className={labelStyles}>Service Address</label>
                    <input ref={locationInputRef} id="jobLocation" type="text" value={jobLocation} onChange={e => setJobLocation(e.target.value)} className={`mt-1 ${inputStyles}`} autoComplete="off"/>
                    {mapsError && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md text-xs text-amber-700 dark:text-amber-300">
                            <p>Address autocomplete unavailable. Check your API Key in Settings.</p>
                            <p className="opacity-70">{mapsError.message}</p>
                        </div>
                    )}
                </div>
                 <div>
                    <label className={labelStyles}>Site Contact</label>
                    <div className="flex gap-2 mt-1">
                        <input type="text" value={jobLocationContactName} onChange={e => setJobLocationContactName(e.target.value)} className={inputStyles} placeholder="Name (if different)"/>
                        <input type="tel" value={jobLocationContactPhone} onChange={e => setJobLocationContactPhone(e.target.value)} className={inputStyles} placeholder="Phone"/>
                    </div>
                </div>
            </div>
             {/* Status History */}
            <div>
              <div className="flex justify-between items-center mb-2">
                  <label className={labelStyles}>Status History</label>
                  <button type="button" onClick={addHistoryEntry} className="flex items-center space-x-1 text-sm text-sky-600 font-medium hover:text-sky-700 dark:hover:text-sky-500"><PlusIcon className="w-4 h-4"/><span>New Status</span></button>
              </div>
              <div className="space-y-2">
                  {statusHistory.map((h, index) => (
                      <div key={h.id} className={`p-3 border rounded-lg ${index === 0 ? 'bg-slate-50 dark:bg-slate-700/50' : 'bg-white dark:bg-slate-800'}`}>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                              <div>
                                  <label className="text-xs text-slate-500 dark:text-slate-400">Status</label>
                                  <select value={h.status} onChange={(e) => handleHistoryChange(h.id, 'status', e.target.value)} className={inputStyles}>
                                      {visibleStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                              <div className="flex items-end gap-2">
                                  <div className="flex-grow">
                                      <label className="text-xs text-slate-500 dark:text-slate-400">Timestamp</label>
                                      <input type="datetime-local" value={getLocalDatetimeString(h.timestamp)} onChange={e => handleHistoryChange(h.id, 'timestamp', e.target.value)} className={inputStyles}/>
                                  </div>
                                  <div className="w-24">
                                      <label className="text-xs text-slate-500 dark:text-slate-400">Duration</label>
                                      <input type="number" value={h.duration || ''} onChange={e => handleHistoryChange(h.id, 'duration', e.target.value)} className={`${inputStyles} pr-1`} placeholder="min"/>
                                  </div>
                              </div>
                              <div className="sm:col-span-2 flex items-end gap-2">
                                  <div className="flex-grow">
                                      <label className="text-xs text-slate-500 dark:text-slate-400">Notes</label>
                                      <input type="text" value={h.notes || ''} onChange={e => handleHistoryChange(h.id, 'notes', e.target.value)} className={inputStyles} placeholder="Notes for this status..." />
                                  </div>
                                  {statusHistory.length > 1 && <button type="button" onClick={() => deleteHistoryEntry(h.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full flex-shrink-0"><TrashIcon className="w-4 h-4"/></button>}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
            </div>

            {/* Financials */}
            <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Financials</h3>

                {/* Templates & Catalog */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="template-select" className={labelStyles}>Apply Template</label>
                    <select id="template-select" onChange={e => handleTemplateSelect(e.target.value)} className={`mt-1 ${inputStyles}`} value="">
                      <option value="">Select a template...</option>
                      {jobTemplates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                      <label htmlFor="part-select" className={labelStyles}>Quick Add from Catalog</label>
                      <select id="part-select" onChange={e => { handleQuickAddPart(e.target.value); (e.target as HTMLSelectElement).value = ''; }} className={`mt-1 ${inputStyles}`} value="">
                          <option value="">Select a part...</option>
                          {partsCatalog?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                  </div>
                </div>

                {/* Parts */}
                <div>
                    <h4 className="text-md font-medium text-slate-700 dark:text-slate-200 mb-2">Parts & Services</h4>
                    <div className="space-y-2">
                        {parts.map((part, index) => (
                            <div key={part.id} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_40px] gap-2 items-center">
                                <input type="text" placeholder="Part/Service Name" value={part.name} onChange={(e) => handlePartChange(part.id, 'name', e.target.value)} className={inputStyles} aria-label="Part or Service" />
                                <input type="number" placeholder="1" value={part.quantity} onChange={(e) => handlePartChange(part.id, 'quantity', e.target.value)} className={`${inputStyles} text-center`} min="1" aria-label="Quantity" />
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div>
                                    <input type="number" placeholder="0.00" value={part.cost} onChange={(e) => handlePartChange(part.id, 'cost', e.target.value)} className={`${inputStyles} pl-7 pr-2`} aria-label="Price" />
                                </div>
                                <button type="button" onClick={() => handleRemovePart(part.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full justify-self-end sm:justify-self-center">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddPart} className="mt-2 flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900">
                        <PlusIcon className="w-4 h-4 mr-2" /> Add Part
                    </button>
                </div>

                 {/* Costs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="labor-cost" className={labelStyles}>Labor Cost</label>
                        <div className="relative mt-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div>
                            <input type="number" id="labor-cost" value={laborCost} onChange={(e) => setLaborCost(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`${inputStyles} pl-7`} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="deposit" className={labelStyles}>Deposit Paid</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <div className="relative flex-grow">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div>
                                <input type="number" id="deposit" value={deposit} onChange={(e) => setDeposit(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`${inputStyles} pl-7`} />
                            </div>
                            <button
                                type="button"
                                onClick={handleCalculate30PercentDeposit}
                                className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                30%
                            </button>
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="paymentStatus" className={labelStyles}>Payment Status</label>
                        <select id="paymentStatus" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className={`mt-1 ${inputStyles}`}>
                            <option value="unpaid">Unpaid</option>
                            <option value="deposit_paid">Deposit Paid</option>
                            <option value="paid_in_full">Paid in Full</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="sales-tax-rate" className={labelStyles}>Sales Tax (%)</label>
                        <input type="number" id="sales-tax-rate" value={salesTaxRate} onChange={(e) => setSalesTaxRate(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`mt-1 ${inputStyles}`} step="0.01" placeholder="e.g. 8.5" />
                    </div>
                    <div>
                        <label htmlFor="processing-fee-rate" className={labelStyles}>Card Fee (%)</label>
                        <input type="number" id="processing-fee-rate" value={processingFeeRate} onChange={(e) => setProcessingFeeRate(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`mt-1 ${inputStyles}`} step="0.01" placeholder="e.g. 2.9" />
                    </div>
                </div>
            </div>
            
            {/* Notes */}
            <div>
                <label htmlFor="jobNotes" className={labelStyles}>Job Notes</label>
                <textarea id="jobNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className={`mt-1 ${inputStyles}`} placeholder="Details about the job..."></textarea>
            </div>

          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t dark:border-slate-700 flex-shrink-0">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                <span>Total: ${totalCost.toFixed(2)}</span>
                <span className="ml-4">Balance: ${balanceDue.toFixed(2)}</span>
            </div>
            <div className="flex space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">
                Save Job
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    {isTemplateConfirmOpen && (
        <ConfirmationModal
            isOpen={isTemplateConfirmOpen}
            onClose={() => setIsTemplateConfirmOpen(false)}
            onConfirm={applyTemplate}
            title="Apply Template"
            message="This will overwrite existing notes, parts, and costs. Are you sure?"
            confirmText="Apply"
            confirmButtonClass="bg-sky-500 hover:bg-sky-600"
        />
    )}
    </>
  );
};

export default JobTicketModal;