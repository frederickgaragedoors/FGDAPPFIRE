
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { JobTicket, JobStatus, Part, JobTemplate, ALL_JOB_STATUSES, CatalogItem, PaymentStatus } from '../types.ts';
import { XIcon, PlusIcon, TrashIcon } from './icons.tsx';
import { generateId, calculateJobTicketTotal } from '../utils.ts';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

// Declare google for TS
declare const google: any;

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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [status, setStatus] = useState<JobStatus>('Estimate Scheduled');
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

  const locationInputRef = useRef<HTMLInputElement>(null);
  const { isLoaded: isMapsLoaded } = useGoogleMaps(apiKey);

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setTime(entry.time || '');
      setDuration(entry.duration || '');
      setStatus(entry.status);
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
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setTime('');
      setDuration('');
      setStatus('Estimate Scheduled');
      // Default to contact address for new tickets if available
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
  
  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) return;
    const selectedTemplate = jobTemplates?.find(t => t.id === templateId);
    if (selectedTemplate) {
        setNotes(selectedTemplate.notes);
        setParts(selectedTemplate.parts.map(p => ({...p, id: generateId()})));
        setLaborCost(selectedTemplate.laborCost);
        setSalesTaxRate(selectedTemplate.salesTaxRate || defaultSalesTaxRate || 0);
        setProcessingFeeRate(selectedTemplate.processingFeeRate || defaultProcessingFeeRate || 0);
    }
  };
  
  const handleQuickAddPart = (catalogItemId: string) => {
      const item = partsCatalog?.find(i => i.id === catalogItemId);
      if (item) {
          setParts([...parts, { id: generateId(), name: item.name, cost: item.defaultCost, quantity: 1 }]);
      }
  };

  const currentTicketState = useMemo((): JobTicket => ({
      id: entry?.id || '',
      date,
      time,
      duration: duration ? Number(duration) : undefined,
      jobLocation,
      jobLocationContactName,
      jobLocationContactPhone,
      status,
      paymentStatus,
      notes,
      parts,
      laborCost: Number(laborCost || 0),
      salesTaxRate: Number(salesTaxRate || 0),
      processingFeeRate: Number(processingFeeRate || 0),
      deposit: Number(deposit || 0),
      createdAt: entry?.createdAt,
  }), [entry, date, time, duration, jobLocation, jobLocationContactName, jobLocationContactPhone, status, paymentStatus, notes, parts, laborCost, salesTaxRate, processingFeeRate, deposit]);

  const { subtotal, taxAmount, feeAmount, totalCost: finalTotal, balanceDue } = calculateJobTicketTotal(currentTicketState);

  const summaryPaidAmount = paymentStatus === 'paid_in_full' 
    ? finalTotal 
    : (paymentStatus === 'deposit_paid' ? Number(deposit || 0) : 0);
  
  const summaryBalanceDue = finalTotal - summaryPaidAmount;

  const calculate30PercentDeposit = useCallback(() => {
      // Calculate total independent of current deposit state to ensure freshness
      const currentPartsTotal = parts.reduce((sum, part) => sum + (Number(part.cost || 0) * Number(part.quantity || 1)), 0);
      const currentSubtotal = currentPartsTotal + Number(laborCost || 0);
      const currentTax = currentSubtotal * (Number(salesTaxRate || 0) / 100);
      const currentTotalAfterTax = currentSubtotal + currentTax;
      const currentFee = currentTotalAfterTax * (Number(processingFeeRate || 0) / 100);
      const currentTotal = currentTotalAfterTax + currentFee;

      if (currentTotal > 0) {
          const thirtyPercent = currentTotal * 0.30;
          setDeposit(parseFloat(thirtyPercent.toFixed(2)));
      } else {
          setDeposit(0);
      }
  }, [parts, laborCost, salesTaxRate, processingFeeRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim() || parts.length > 0) {
      onSave(currentTicketState);
    } else {
      alert("Please add some notes or parts to the job ticket before saving.");
    }
  };

  const visibleStatuses = useMemo(() => {
    return ALL_JOB_STATUSES.filter(s => 
        (enabledStatuses ? enabledStatuses[s] : true) || (entry && entry.status === s)
    );
  }, [enabledStatuses, entry]);

  const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
  const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
          <div className="p-6 border-b dark:border-slate-700 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{entry ? 'Edit Job Ticket' : 'Add Job Ticket'}</h2>
              <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-grow min-h-0">
            {jobTemplates && jobTemplates.length > 0 && !entry && (
                <div>
                    <label htmlFor="job-template" className={labelStyles}>Apply Template</label>
                    <select
                        id="job-template"
                        onChange={e => handleTemplateSelect(e.target.value)}
                        className={`mt-1 ${inputStyles}`}
                        defaultValue=""
                    >
                        <option value="" disabled>Select a template...</option>
                        {jobTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="job-date" className={labelStyles}>Date</label>
                    <input
                    type="date"
                    id="job-date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className={`mt-1 ${inputStyles}`}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor="job-time" className={labelStyles}>Time <span className="text-xs text-slate-400 font-normal">(Opt)</span></label>
                        <input
                        type="time"
                        id="job-time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className={`mt-1 ${inputStyles}`}
                        />
                    </div>
                    <div>
                        <label htmlFor="job-duration" className={labelStyles}>Est. Min <span className="text-xs text-slate-400 font-normal">(Opt)</span></label>
                        <input
                        type="number"
                        id="job-duration"
                        value={duration}
                        onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className={`mt-1 ${inputStyles}`}
                        placeholder="60"
                        />
                    </div>
                </div>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-md space-y-3">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Service Site Details</h4>
                <div>
                    <label htmlFor="job-location" className={labelStyles}>Address</label>
                    <input
                        ref={locationInputRef}
                        type="text"
                        id="job-location"
                        value={jobLocation}
                        onChange={e => setJobLocation(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') e.preventDefault(); }}
                        className={`mt-1 ${inputStyles}`}
                        placeholder="Leave empty if same as billing..."
                        autoComplete="off"
                    />
                    {contactAddress && contactAddress !== jobLocation && (
                        <button 
                            type="button" 
                            onClick={() => setJobLocation(contactAddress)}
                            className="text-xs text-sky-600 hover:text-sky-700 mt-1"
                        >
                            Reset to Billing Address
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="job-contact-name" className={labelStyles}>Site Contact Name</label>
                        <input
                            type="text"
                            id="job-contact-name"
                            value={jobLocationContactName}
                            onChange={e => setJobLocationContactName(e.target.value)}
                            className={`mt-1 ${inputStyles}`}
                            placeholder="e.g. Tenant Name"
                        />
                    </div>
                    <div>
                        <label htmlFor="job-contact-phone" className={labelStyles}>Site Contact Phone</label>
                        <input
                            type="tel"
                            id="job-contact-phone"
                            value={jobLocationContactPhone}
                            onChange={e => setJobLocationContactPhone(e.target.value)}
                            className={`mt-1 ${inputStyles}`}
                            placeholder="e.g. 555-0199"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="job-status" className={labelStyles}>Status</label>
                <select
                id="job-status"
                value={status}
                onChange={e => setStatus(e.target.value as JobStatus)}
                className={`mt-1 ${inputStyles}`}
                >
                {visibleStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            
            <div>
              <label htmlFor="job-notes" className={labelStyles}>Notes</label>
              <textarea
                id="job-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className={`mt-1 ${inputStyles}`}
                placeholder="Describe the job details..."
              ></textarea>
            </div>
            
            {status !== 'Estimate Scheduled' && (
              <div>
                  <h3 className="text-md font-medium text-slate-700 dark:text-slate-200">Costs & Payments</h3>
                  <div className="mt-2 p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                      <div>
                          <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">Parts Used</h4>
                              {partsCatalog && partsCatalog.length > 0 && (
                                  <select
                                      onChange={(e) => { handleQuickAddPart(e.target.value); e.target.value = ""; }}
                                      className="text-xs border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                      defaultValue=""
                                  >
                                      <option value="" disabled>+ Quick Add</option>
                                      {partsCatalog.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                  </select>
                              )}
                          </div>
                           {parts.length > 0 && (
                              <div className="hidden sm:grid sm:grid-cols-[1fr_80px_120px_40px] sm:gap-x-2 mb-1">
                                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Part or Service</label>
                                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">Qty</label>
                                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Price</label>
                                  <span />
                              </div>
                          )}
                          <div className="space-y-4 sm:space-y-2">
                              {parts.map((part) => (
                                  <div key={part.id} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_40px] sm:gap-x-2 sm:items-center">
                                      <div>
                                          <label htmlFor={`part-name-${part.id}`} className={`${labelStyles} sm:hidden`}>Part or Service</label>
                                          <input
                                              id={`part-name-${part.id}`}
                                              type="text"
                                              placeholder="e.g. Inspection Fee"
                                              value={part.name}
                                              onChange={(e) => handlePartChange(part.id, 'name', e.target.value)}
                                              className={`mt-1 sm:mt-0 ${inputStyles}`}
                                              aria-label="Part or Service"
                                          />
                                      </div>
                                      <div>
                                          <label htmlFor={`part-qty-${part.id}`} className={`${labelStyles} sm:hidden`}>Qty</label>
                                          <input
                                              id={`part-qty-${part.id}`}
                                              type="number"
                                              placeholder="1"
                                              value={part.quantity}
                                              onChange={(e) => handlePartChange(part.id, 'quantity', e.target.value)}
                                              className={`mt-1 sm:mt-0 ${inputStyles} text-center`}
                                              min="1"
                                              aria-label="Qty"
                                          />
                                      </div>
                                      <div>
                                          <label htmlFor={`part-price-${part.id}`} className={`${labelStyles} sm:hidden`}>Price</label>
                                          <div className="relative mt-1 sm:mt-0">
                                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                  <span className="text-slate-500 sm:text-sm">$</span>
                                              </div>
                                              <input
                                                  id={`part-price-${part.id}`}
                                                  type="number"
                                                  placeholder="0.00"
                                                  value={part.cost}
                                                  onChange={(e) => handlePartChange(part.id, 'cost', e.target.value)}
                                                  className={`${inputStyles} pl-7 pr-2`}
                                                  aria-label="Price"
                                              />
                                          </div>
                                      </div>
                                      <div className="flex justify-end sm:justify-center">
                                          <button type="button" onClick={() => handleRemovePart(part.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                              <TrashIcon className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <button type="button" onClick={handleAddPart} className="mt-2 flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors">
                              <PlusIcon className="w-4 h-4 mr-2" /> Add Part
                          </button>
                      </div>

                      <div className="!mt-4">
                          <label htmlFor="labor-cost" className={labelStyles}>Labor Cost</label>
                          <div className="relative mt-1">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                  <span className="text-slate-500 sm:text-sm">$</span>
                              </div>
                              <input
                                  type="number"
                                  id="labor-cost"
                                  value={laborCost}
                                  onChange={(e) => setLaborCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  className={`${inputStyles} pl-7`}
                              />
                          </div>
                      </div>
                      
                      <div className="!mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label htmlFor="sales-tax-rate" className={labelStyles}>Sales Tax (%)</label>
                              <div className="relative mt-1">
                                  <input
                                      type="number"
                                      id="sales-tax-rate"
                                      value={salesTaxRate}
                                      onChange={(e) => setSalesTaxRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                      className={`${inputStyles} pr-2`}
                                      step="0.01"
                                      placeholder="e.g. 8.5"
                                  />
                              </div>
                          </div>
                          <div>
                              <label htmlFor="processing-fee-rate" className={labelStyles}>Card Processing Fee (%)</label>
                              <div className="relative mt-1">
                                  <input
                                      type="number"
                                      id="processing-fee-rate"
                                      value={processingFeeRate}
                                      onChange={(e) => setProcessingFeeRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                      className={`${inputStyles} pr-2`}
                                      step="0.01"
                                      placeholder="e.g. 2.9"
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="!mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                          <label className={`${labelStyles} mb-2`}>Payment Status</label>
                          <div className="flex space-x-2 mb-4">
                              <button
                                  type="button"
                                  onClick={() => setPaymentStatus('unpaid')}
                                  className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-colors border ${
                                      paymentStatus === 'unpaid'
                                          ? 'bg-slate-200 border-slate-300 text-slate-800 dark:bg-slate-600 dark:border-slate-500 dark:text-white'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                                  }`}
                              >
                                  Unpaid
                              </button>
                              <button
                                  type="button"
                                  onClick={() => setPaymentStatus('deposit_paid')}
                                  className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-colors border ${
                                      paymentStatus === 'deposit_paid'
                                          ? 'bg-sky-100 border-sky-200 text-sky-800 dark:bg-sky-900/40 dark:border-sky-800 dark:text-sky-200'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                                  }`}
                              >
                                  Deposit Paid
                              </button>
                              <button
                                  type="button"
                                  onClick={() => setPaymentStatus('paid_in_full')}
                                  className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-colors border ${
                                      paymentStatus === 'paid_in_full'
                                          ? 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900/40 dark:border-green-800 dark:text-green-200'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                                  }`}
                              >
                                  Paid in Full
                              </button>
                          </div>

                          <label htmlFor="deposit-amount" className={labelStyles}>
                              {paymentStatus === 'deposit_paid' ? 'Amount Collected (Deposit)' : 'Required Deposit Amount'}
                          </label>
                          <div className="flex space-x-2">
                             <div className="relative mt-1 flex-grow">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <span className="text-slate-500 sm:text-sm">$</span>
                                </div>
                                <input
                                    type="number"
                                    id="deposit-amount"
                                    value={deposit}
                                    onChange={(e) => setDeposit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    className={`${inputStyles} pl-7`}
                                    placeholder="0.00"
                                    disabled={paymentStatus === 'paid_in_full'}
                                />
                             </div>
                             <button
                                type="button"
                                onClick={calculate30PercentDeposit}
                                className="mt-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Calculate 30% Deposit"
                                disabled={paymentStatus === 'paid_in_full' || finalTotal <= 0}
                             >
                                 30%
                             </button>
                          </div>
                      </div>
                  </div>
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t dark:border-slate-700 flex-shrink-0">
            {status !== 'Estimate Scheduled' ? (
                <div className="text-sm dark:text-slate-300">
                    <p>Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></p>
                    <p>Tax ({Number(salesTaxRate || 0)}%): <span className="font-medium">${taxAmount.toFixed(2)}</span></p>
                    <p>Card Fee ({Number(processingFeeRate || 0)}%): <span className="font-medium">${feeAmount.toFixed(2)}</span></p>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-100 mt-1">Total: <span className="font-bold text-xl">${finalTotal.toFixed(2)}</span></p>
                    
                    {summaryPaidAmount > 0 && (
                        <p className="text-green-600 dark:text-green-400 font-medium mt-1">Paid: -${summaryPaidAmount.toFixed(2)}</p>
                    )}
                    <p className="font-bold text-slate-800 dark:text-slate-100 mt-1">Balance: <span className="font-bold">${summaryBalanceDue.toFixed(2)}</span></p>
                </div>
            ) : (
                <div></div>
            )}
            <div className="flex space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">
                Save Ticket
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobTicketModal;
