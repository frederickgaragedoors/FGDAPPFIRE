import React, { useState } from 'react';
import { Contact, JobTicket, BusinessInfo, JobTemplate, jobStatusColors, JobStatus, CatalogItem, paymentStatusColors, paymentStatusLabels, DEFAULT_ON_MY_WAY_TEMPLATE, InspectionItem } from '../types.ts';
import JobTicketModal from './JobTicketModal.tsx';
import InspectionModal from './InspectionModal.tsx';
import {
  ArrowLeftIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  EditIcon,
  TrashIcon,
  ClipboardListIcon,
  MessageIcon,
  CarIcon,
  UserCircleIcon,
  ClipboardCheckIcon,
} from './icons.tsx';
import { calculateJobTicketTotal, formatTime, processTemplate, formatPhoneNumber } from '../utils.ts';

interface JobDetailViewProps {
  contact: Contact;
  ticket: JobTicket;
  businessInfo: BusinessInfo;
  jobTemplates: JobTemplate[];
  partsCatalog: CatalogItem[];
  onBack: () => void;
  onEditTicket: (ticketData: Omit<JobTicket, 'id'> & { id?: string }) => void;
  onDeleteTicket: () => void;
  onViewInvoice: () => void;
  enabledStatuses: Record<JobStatus, boolean>;
  apiKey?: string;
}

const JobDetailView: React.FC<JobDetailViewProps> = ({
  contact,
  ticket,
  businessInfo,
  jobTemplates,
  partsCatalog,
  onBack,
  onEditTicket,
  onDeleteTicket,
  onViewInvoice,
  enabledStatuses,
  apiKey,
}) => {
  const [isJobTicketModalOpen, setIsJobTicketModalOpen] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

  const { subtotal, taxAmount, feeAmount, totalCost, deposit } = calculateJobTicketTotal(ticket);
  const statusColor = jobStatusColors[ticket.status];
  
  const paymentStatus = ticket.paymentStatus || 'unpaid';
  const paymentStatusColor = paymentStatusColors[paymentStatus];
  const paymentStatusLabel = paymentStatusLabels[paymentStatus];

  const hasCosts = ticket.parts.length > 0 || (ticket.laborCost && ticket.laborCost > 0);
  
  let paidAmount = 0;
  if (paymentStatus === 'paid_in_full') {
      paidAmount = totalCost;
  } else if (paymentStatus === 'deposit_paid') {
      paidAmount = deposit;
  }
  const displayBalance = totalCost - paidAmount;

  // Determine target location for map/service
  const serviceLocation = ticket.jobLocation || contact.address;
  const isDifferentLocation = ticket.jobLocation && ticket.jobLocation !== contact.address;

  // Prioritize Site Contact for communication actions
  const primaryPhone = ticket.jobLocationContactPhone || contact.phone;
  const primaryName = ticket.jobLocationContactName || contact.name;

  // SMS Link for "On My Way"
  const template = businessInfo.onMyWayTemplate || DEFAULT_ON_MY_WAY_TEMPLATE;
  const smsBody = processTemplate(template, {
    customerName: primaryName.split(' ')[0],
    businessName: businessInfo.name || 'your technician'
  });
  const smsLink = `sms:${primaryPhone}?body=${encodeURIComponent(smsBody)}`;
  
  // Inspection Summary
  const inspectionItems = ticket.inspection || [];
  const totalInspectionItems = inspectionItems.length;
  const failedItems = inspectionItems.filter(i => i.status === 'Fail').length;
  const repairedItems = inspectionItems.filter(i => i.status === 'Repaired').length;
  const passedItems = inspectionItems.filter(i => i.status === 'Pass').length;

  return (
    <>
      <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
        {/* Header with Action Buttons */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
              <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </button>
            <h2 className="ml-4 font-bold text-lg text-slate-700 dark:text-slate-200">
              Job Details
            </h2>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
             <button 
                onClick={onViewInvoice} 
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="View PDF"
            >
                <ClipboardListIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={() => setIsJobTicketModalOpen(true)} 
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="Edit Job"
            >
                <EditIcon className="w-5 h-5" />
            </button>
             <button 
                onClick={onDeleteTicket} 
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                title="Delete Job"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Compact Status Bar */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</span>
                 <span className={`px-2 py-0.5 rounded text-sm font-bold ${statusColor.base} ${statusColor.text} inline-block`}>{ticket.status}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-right sm:text-left">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Payment</span>
                 <span className={`px-2 py-0.5 rounded text-sm font-bold ${paymentStatusColor.base} ${paymentStatusColor.text} inline-block`}>{paymentStatusLabel}</span>
            </div>
        </div>

        <div className="px-4 sm:px-6 py-6 flex-grow space-y-6">
          
          {/* Job Logistics Card - Ticket Stub Style */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            {/* Header Strip */}
            <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                <div className="flex space-x-4">
                    <div>
                        <span className="text-[10px] uppercase opacity-70 block">Date</span>
                        <span className="font-bold">
                            {new Date(ticket.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] uppercase opacity-70 block">Time</span>
                        <span className="font-bold">{ticket.time ? formatTime(ticket.time) : 'Anytime'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] uppercase opacity-70 block">Ticket #</span>
                    <span className="font-mono font-bold text-sky-400">{ticket.id}</span>
                </div>
            </div>

            {/* Body */}
            <div className="p-5 pb-2">
                <div className="mb-6">
                    <span className="text-xs font-bold text-slate-400 uppercase mb-1 block">Work Notes</span>
                    <p className="text-slate-800 dark:text-slate-200 text-base whitespace-pre-wrap break-words">
                        {ticket.notes || 'No notes provided for this job.'}
                    </p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 grid grid-cols-2 gap-4">
                    {/* Location Col */}
                    <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                            <MapPinIcon className="w-3 h-3 mr-1 flex-shrink-0" /> Site Location
                            </p>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(serviceLocation)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-sm text-slate-800 dark:text-slate-200 hover:text-sky-600 hover:underline whitespace-pre-line block break-words"
                            >
                                {serviceLocation || 'No address provided'}
                            </a>
                            {ticket.jobLocationContactName && (
                                <p className="text-xs text-slate-500 mt-1 truncate">Contact: {ticket.jobLocationContactName}</p>
                            )}
                            {ticket.jobLocationContactPhone && (
                                <div className="flex items-center mt-1 space-x-2">
                                    <a href={`tel:${ticket.jobLocationContactPhone}`} className="text-xs text-slate-500 hover:text-sky-600 hover:underline flex items-center">
                                       <PhoneIcon className="w-3 h-3 mr-1" />
                                       {ticket.jobLocationContactPhone}
                                    </a>
                                </div>
                            )}
                    </div>

                    {/* Client Col */}
                    <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                            <UserCircleIcon className="w-3 h-3 mr-1 flex-shrink-0" /> Client / Billing
                            </p>
                            <div className="flex flex-col">
                                <button onClick={onBack} className="font-semibold text-sm text-slate-800 dark:text-slate-100 hover:underline text-left truncate max-w-full">
                                    {contact.name}
                                </button>
                                <a href={`tel:${contact.phone}`} className="text-xs text-slate-500 mt-1 truncate hover:text-sky-600 hover:underline block">
                                    {contact.phone}
                                </a>
                                <a href={`mailto:${contact.email}`} className="text-xs text-slate-500 hover:text-sky-600 block mt-0.5 truncate">{contact.email}</a>
                            </div>
                    </div>
                </div>
            </div>

             {/* Action Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 p-3">
                 <div className="grid grid-cols-3 gap-3">
                     <a href={`tel:${primaryPhone}`} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 transition-all group">
                         <PhoneIcon className="w-5 h-5 text-green-600 dark:text-green-500 mb-1 group-hover:scale-110 transition-transform" />
                         <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-green-700 dark:group-hover:text-green-400">Call</span>
                     </a>
                     <a href={`sms:${primaryPhone}`} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-200 dark:hover:border-sky-800 transition-all group">
                         <MessageIcon className="w-5 h-5 text-sky-600 dark:text-sky-500 mb-1 group-hover:scale-110 transition-transform" />
                         <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-sky-700 dark:group-hover:text-sky-400">Text</span>
                     </a>
                     <a href={smsLink} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                         <CarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
                         <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">On My Way</span>
                     </a>
                 </div>
            </div>
          </div>
          
          {/* Safety Inspection Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                      <ClipboardCheckIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-2" />
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Safety Inspection</h3>
                  </div>
                  {totalInspectionItems > 0 && (
                       <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{passedItems + repairedItems + failedItems} / {totalInspectionItems} Checked</span>
                  )}
              </div>
              
              {totalInspectionItems === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-6 text-center border border-dashed border-slate-300 dark:border-slate-600">
                      <p className="text-slate-500 dark:text-slate-400 mb-3 text-sm">Documenting the 25-point inspection protects your business and ensures safety.</p>
                      <button 
                        onClick={() => setIsInspectionModalOpen(true)}
                        className="px-4 py-2 bg-sky-500 text-white font-medium rounded-md hover:bg-sky-600 transition-colors text-sm"
                      >
                          Start Inspection
                      </button>
                  </div>
              ) : (
                  <div>
                       <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                           <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800">
                               <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedItems}</p>
                               <p className="text-xs text-red-600 dark:text-red-300 uppercase font-bold">Fail</p>
                           </div>
                           <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800">
                               <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{repairedItems}</p>
                               <p className="text-xs text-blue-600 dark:text-blue-300 uppercase font-bold">Repaired</p>
                           </div>
                           <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-100 dark:border-green-800">
                               <p className="text-2xl font-bold text-green-600 dark:text-green-400">{passedItems}</p>
                               <p className="text-xs text-green-600 dark:text-green-300 uppercase font-bold">Pass</p>
                           </div>
                       </div>
                       <button 
                            onClick={() => setIsInspectionModalOpen(true)}
                            className="w-full py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                       >
                           Edit Inspection
                       </button>
                  </div>
              )}
          </div>

          {/* Costs Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 border-b dark:border-slate-700 pb-2">Cost Breakdown</h3>
            {hasCosts ? (
                <>
                    <div className="">
                        <table className="w-full text-left text-xs sm:text-sm table-fixed">
                            <thead>
                            <tr className="border-b dark:border-slate-700">
                                <th className="py-2 px-1 sm:px-2 font-medium w-[40%]">Item/Service</th>
                                <th className="py-2 px-1 sm:px-2 font-medium text-center w-[12%]">Qty</th>
                                <th className="py-2 px-1 sm:px-2 font-medium text-right w-[24%]">Unit</th>
                                <th className="py-2 px-1 sm:px-2 font-medium text-right w-[24%]">Total</th>
                            </tr>
                            </thead>
                            <tbody>
                            {ticket.parts.map(p => (
                                <tr key={p.id} className="border-b dark:border-slate-700/50">
                                <td className="py-2 px-1 sm:px-2 break-words align-top">{p.name}</td>
                                <td className="py-2 px-1 sm:px-2 text-center align-top whitespace-nowrap">{p.quantity}</td>
                                <td className="py-2 px-1 sm:px-2 text-right align-top whitespace-nowrap">${p.cost.toFixed(2)}</td>
                                <td className="py-2 px-1 sm:px-2 text-right align-top whitespace-nowrap">${(p.cost * p.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="border-b dark:border-slate-700/50">
                                <td className="py-2 px-1 sm:px-2">Labor</td>
                                <td colSpan={2}></td>
                                <td className="py-2 px-1 sm:px-2 text-right whitespace-nowrap">${ticket.laborCost.toFixed(2)}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <div className="w-full max-w-xs space-y-1">
                        <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Tax ({ticket.salesTaxRate || 0}%):</span><span>${taxAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Fee ({ticket.processingFeeRate || 0}%):</span><span>${feeAmount.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t dark:border-slate-600"><span>Total:</span><span>${totalCost.toFixed(2)}</span></div>
                        
                        {paymentStatus === 'unpaid' && deposit > 0 && (
                            <div className="flex justify-between text-slate-500 dark:text-slate-400 italic text-sm"><span>Required Deposit:</span><span>${deposit.toFixed(2)}</span></div>
                        )}

                        {paidAmount > 0 && (
                            <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                                <span>{paymentStatus === 'paid_in_full' ? 'Paid in Full' : 'Deposit Paid'}:</span> 
                                <span>-${paidAmount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 mt-1 pt-1 border-t border-slate-200 dark:border-slate-700"><span>Balance Due:</span><span>${displayBalance.toFixed(2)}</span></div>
                        </div>
                    </div>
                </>
            ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 italic py-4">No costs have been associated with this job yet.</p>
            )}
          </div>
        </div>
      </div>

      {isJobTicketModalOpen && (
        <JobTicketModal
          entry={ticket}
          onSave={(updatedTicket) => {
            onEditTicket(updatedTicket);
            setIsJobTicketModalOpen(false);
          }}
          onClose={() => setIsJobTicketModalOpen(false)}
          jobTemplates={jobTemplates}
          partsCatalog={partsCatalog}
          enabledStatuses={enabledStatuses}
          contactAddress={contact.address}
          apiKey={apiKey}
        />
      )}

      {isInspectionModalOpen && (
        <InspectionModal
          existingInspection={ticket.inspection}
          onSave={(inspection) => {
            onEditTicket({ ...ticket, inspection });
            setIsInspectionModalOpen(false);
          }}
          onClose={() => setIsInspectionModalOpen(false)}
        />
      )}
    </>
  );
};

export default JobDetailView;