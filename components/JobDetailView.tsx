import React, { useState, useMemo } from 'react';
import { Contact, JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels, DEFAULT_ON_MY_WAY_TEMPLATE, JobStatus, StatusHistoryEntry } from '../types.ts';
import { useData } from '../contexts/DataContext.tsx';
import JobTicketModal from './JobTicketModal.tsx';
import InspectionModal from './InspectionModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import StatusUpdateModal from './StatusUpdateModal.tsx';
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
  MapIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
} from './icons.tsx';
import { calculateJobTicketTotal, formatTime, processTemplate, formatPhoneNumber } from '../utils.ts';

interface JobDetailViewProps {
  contactId: string;
  ticketId: string;
  onBack: () => void;
  onViewInvoice: () => void;
  onViewRouteForDate: (date: string) => void;
}

const statusToIconMap: Record<JobStatus, { Icon: React.FC<{className?: string}>, color: string }> = {
    'Estimate Scheduled': { Icon: CalendarIcon, color: 'text-slate-500 dark:text-slate-400' },
    'Quote Sent': { Icon: MailIcon, color: 'text-orange-500 dark:text-orange-400' },
    'Scheduled': { Icon: ClipboardCheckIcon, color: 'text-sky-500 dark:text-sky-400' },
    'In Progress': { Icon: WrenchScrewdriverIcon, color: 'text-yellow-500 dark:text-yellow-400' },
    'Awaiting Parts': { Icon: ClockIcon, color: 'text-purple-500 dark:text-purple-400' },
    'Completed': { Icon: CheckCircleIcon, color: 'text-green-500 dark:text-green-400' },
    'Paid': { Icon: CurrencyDollarIcon, color: 'text-indigo-500 dark:text-indigo-400' },
    'Declined': { Icon: XCircleIcon, color: 'text-red-500 dark:text-red-400' },
};


// FIX: Changed to a named export to resolve a module resolution issue.
export const JobDetailView: React.FC<JobDetailViewProps> = ({
  contactId,
  ticketId,
  onBack,
  onViewInvoice,
  onViewRouteForDate,
}) => {
  const { 
    contacts,
    businessInfo, 
    jobTemplates, 
    partsCatalog, 
    enabledStatuses, 
    mapSettings,
    handleUpdateContactJobTickets,
    handleSaveStatusHistoryEntry,
    handleDeleteStatusHistoryEntry,
  } = useData();
  
  const contact = contacts.find(c => c.id === contactId);
  const ticket = contact?.jobTickets.find(t => t.id === ticketId);

  const [isJobTicketModalOpen, setIsJobTicketModalOpen] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingStatusEntry, setEditingStatusEntry] = useState<StatusHistoryEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (!contact || !ticket) {
        return (
            <div className="p-4">
                <p>Could not find the requested job ticket.</p>
                <button onClick={onBack}>Go Back</button>
            </div>
        );
  }

  const { subtotal, taxAmount, feeAmount, totalCost, deposit } = calculateJobTicketTotal(ticket);
  
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

  const serviceLocation = ticket.jobLocation || contact.address;
  const primaryPhone = ticket.jobLocationContactPhone || contact.phone;
  const primaryName = ticket.jobLocationContactName || contact.name;

  const template = businessInfo.onMyWayTemplate || DEFAULT_ON_MY_WAY_TEMPLATE;
  const smsBody = processTemplate(template, {
    customerName: primaryName.split(' ')[0],
    businessName: businessInfo.name || 'your technician'
  });
  const smsLink = `sms:${primaryPhone}?body=${encodeURIComponent(smsBody)}`;
  
  const inspectionItems = ticket.inspection || [];
  const totalInspectionItems = inspectionItems.length;
  const failedItems = inspectionItems.filter(i => i.status === 'Fail').length;
  const repairedItems = inspectionItems.filter(i => i.status === 'Repaired').length;
  const passedItems = inspectionItems.filter(i => i.status === 'Pass').length;
  
  const performDeleteTicket = () => {
    const updatedTickets = contact.jobTickets.filter(t => t.id !== ticket.id);
    handleUpdateContactJobTickets(contact.id, updatedTickets);
    onBack();
  };

  const statusHistory = useMemo(() => {
    const history = ticket.statusHistory || [{ id: 'fallback', status: ticket.status, timestamp: ticket.createdAt || ticket.date, duration: ticket.duration }];
    return [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [ticket.statusHistory, ticket.status, ticket.createdAt, ticket.date, ticket.duration]);
  
  const currentStatus = statusHistory[0]?.status || ticket.status;
  const statusColor = jobStatusColors[currentStatus];

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
          <div className="flex items-center space-x-2">
             <button 
                onClick={onViewInvoice} 
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
                title="View PDF"
            >
                <ClipboardListIcon className="w-5 h-5" />
                <span className="hidden sm:inline">PDF</span>
            </button>
            <button 
                onClick={() => setIsJobTicketModalOpen(true)} 
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title="Edit Job"
            >
                <EditIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Edit</span>
            </button>
             <button 
                onClick={() => setIsConfirmationModalOpen(true)}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                title="Delete Job"
            >
                <TrashIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            {/* Top Info Header Card */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-5">
                    <p className="font-semibold text-lg text-slate-800 dark:text-slate-100">
                        {new Date(ticket.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {ticket.time ? formatTime(ticket.time) : 'Anytime'} • Est. {ticket.duration || 60} min
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-2">Ticket #{ticket.id}</p>
                </div>
            </div>
            
            {/* Work Notes Card */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4 border-b dark:border-slate-700 pb-3">
                    <ClipboardListIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Work Notes</h3>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-base whitespace-pre-wrap break-words">
                    {ticket.notes || 'No notes provided for this job.'}
                </p>
            </div>

            {/* Safety Inspection Card */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                        <ClipboardCheckIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
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
              <div className="flex items-center mb-4 border-b dark:border-slate-700 pb-3">
                  <CurrencyDollarIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cost Breakdown</h3>
              </div>
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
          
          <div className="lg:col-span-1 space-y-6">
              {/* Job Timeline */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Job Timeline</h3>
                    <button onClick={() => { setEditingStatusEntry(null); setIsStatusModalOpen(true); }} className="px-3 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-md">Update Status</button>
                </div>
                <ul>
                  {statusHistory.map((entry, index) => {
                    const { Icon, color } = statusToIconMap[entry.status];
                    return (
                      <li key={entry.id || entry.timestamp} className="relative pb-8">
                        {index !== statusHistory.length - 1 && (
                          <span className="absolute top-5 left-[15px] -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                        )}
                        <div className="relative flex items-start space-x-3">
                            <div className="relative">
                                <span className={`h-8 w-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center ring-4 ${index === 0 ? 'ring-sky-200 dark:ring-sky-800' : 'ring-slate-100 dark:ring-slate-900'}`}>
                                    <Icon className={`w-5 h-5 ${color}`} />
                                </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5">
                                <div className="flex justify-between items-center">
                                    <p className={`text-sm font-medium ${index === 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{entry.status}</p>
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                                            className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600"
                                            aria-label="More options"
                                        >
                                            <EllipsisVerticalIcon className="w-5 h-5" />
                                        </button>
                                        {openMenuId === entry.id && (
                                            <div className="absolute right-0 mt-1 w-28 bg-white dark:bg-slate-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5">
                                                <button
                                                    onClick={() => { setEditingStatusEntry(entry); setIsStatusModalOpen(true); setOpenMenuId(null); }}
                                                    className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4 mr-2" /> Edit
                                                </button>
                                                {statusHistory.length > 1 && (
                                                    <button
                                                        onClick={() => { handleDeleteStatusHistoryEntry(contactId, ticketId, entry.id); setOpenMenuId(null); }}
                                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                    >
                                                        <TrashIcon className="w-4 h-4 mr-2" /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(entry.timestamp).toLocaleString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                    })}
                                    {entry.duration && ` • ${entry.duration} min`}
                                </p>
                                {entry.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md border border-slate-200 dark:border-slate-700 whitespace-pre-wrap break-words">{entry.notes}</p>}
                            </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Client & Site Info Card */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="p-5 space-y-5">
                      {/* Client / Billing Block */}
                      <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                              <UserCircleIcon className="w-3 h-3 mr-1 flex-shrink-0" /> Client / Billing
                          </p>
                          <div className="flex flex-col">
                              <button onClick={onBack} className="font-semibold text-lg text-slate-800 dark:text-slate-100 hover:underline text-left truncate max-w-full">
                                  {contact.name}
                              </button>
                              <a href={`tel:${contact.phone}`} className="text-sm text-slate-500 mt-1 truncate hover:text-sky-600 hover:underline block">
                                  {contact.phone}
                              </a>
                              <a href={`mailto:${contact.email}`} className="text-sm text-slate-500 hover:text-sky-600 block mt-0.5 truncate">{contact.email}</a>
                          </div>
                      </div>
                      
                      {/* Site Location Block */}
                      <div className="min-w-0 border-t border-slate-200 dark:border-slate-700 pt-5">
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
                  </div>
                  
                  {/* Action Footer */}
                  <div className="bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 p-3 rounded-b-lg">
                      <div className="grid grid-cols-4 gap-3">
                          <a href={`tel:${primaryPhone}`} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 transition-all group">
                              <PhoneIcon className="w-5 h-5 text-green-600 dark:text-green-500 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-green-700 dark:group-hover:text-green-400">Call</span>
                          </a>
                          <a href={`sms:${primaryPhone}`} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-200 dark:hover:border-sky-800 transition-all group">
                              <MessageIcon className="w-5 h-5 text-sky-600 dark:text-sky-500 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-sky-700 dark:group-hover:text-sky-400">Text</span>
                          </a>
                          <a href={smsLink} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group text-center">
                              <CarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 leading-tight text-center">On My Way</span>
                          </a>
                          <button
                              onClick={() => onViewRouteForDate(ticket.date)}
                              className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900/20 hover:border-slate-300 dark:hover:border-slate-500 transition-all group text-center"
                          >
                              <MapIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-200 leading-tight text-center">View Route</span>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        </div>
      </div>

      {isJobTicketModalOpen && (
        <JobTicketModal
          entry={ticket}
          onSave={(updatedTicket) => {
            handleUpdateContactJobTickets(contact.id, updatedTicket);
            setIsJobTicketModalOpen(false);
          }}
          onClose={() => setIsJobTicketModalOpen(false)}
          jobTemplates={jobTemplates}
          partsCatalog={partsCatalog}
          enabledStatuses={enabledStatuses}
          contactAddress={contact.address}
          apiKey={mapSettings?.apiKey}
        />
      )}

      {isInspectionModalOpen && (
        <InspectionModal
          existingInspection={ticket.inspection}
          onSave={(inspection) => {
            handleUpdateContactJobTickets(contact.id, { ...ticket, inspection });
            setIsInspectionModalOpen(false);
          }}
          onClose={() => setIsInspectionModalOpen(false)}
        />
      )}
      
       {isStatusModalOpen && (
        <StatusUpdateModal
          entry={editingStatusEntry}
          onSave={(entry) => {
            handleSaveStatusHistoryEntry(contactId, ticketId, entry);
            setIsStatusModalOpen(false);
            setEditingStatusEntry(null);
          }}
          onClose={() => {
            setIsStatusModalOpen(false);
            setEditingStatusEntry(null);
          }}
          enabledStatuses={enabledStatuses}
        />
      )}

      {isConfirmationModalOpen && (
        <ConfirmationModal
          isOpen={isConfirmationModalOpen}
          onClose={() => setIsConfirmationModalOpen(false)}
          onConfirm={performDeleteTicket}
          title="Delete Job Ticket"
          message="Are you sure you want to delete this job ticket? This action cannot be undone."
        />
      )}
    </>
  );
};
