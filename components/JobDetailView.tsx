import React, { useState, useMemo } from 'react';
import { Contact, JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels, DEFAULT_ON_MY_WAY_TEMPLATE, JobStatus, StatusHistoryEntry, SafetyInspection, Supplier } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import JobTicketModal from './JobTicketModal.tsx';
import InspectionModal from './InspectionModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
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
  PlusIcon
} from './icons.tsx';
import { calculateJobTicketTotal, formatTime, processTemplate, formatPhoneNumber, generateId } from '../utils.ts';

interface JobDetailViewProps {
  contactId: string;
  ticketId: string;
  onBack: () => void;
  onViewInvoice: () => void;
  onViewRouteForDate: (date: string) => void;
}

// FIX: This commit resolves multiple TypeScript errors by refactoring the component to be fully compatible with the `statusHistory`-based data model. It removes all references to deprecated properties like `date`, `time`, and `status` on the `JobTicket` object. Job date and time are now correctly derived from the latest status entry, and the status-to-icon mapping has been updated to include 'Job Created', preventing crashes and ensuring data consistency.
const statusToIconMap: Record<JobStatus, { Icon: React.FC<{className?: string}>, color: string }> = {
    'Job Created': { Icon: ClipboardListIcon, color: 'text-gray-500 dark:text-gray-400' },
    'Estimate Scheduled': { Icon: CalendarIcon, color: 'text-slate-500 dark:text-slate-400' },
    'Quote Sent': { Icon: MailIcon, color: 'text-orange-500 dark:text-orange-400' },
    'Scheduled': { Icon: ClipboardCheckIcon, color: 'text-sky-500 dark:text-sky-400' },
    'In Progress': { Icon: WrenchScrewdriverIcon, color: 'text-yellow-500 dark:text-yellow-400' },
    'Awaiting Parts': { Icon: ClockIcon, color: 'text-purple-500 dark:text-purple-400' },
    'Supplier Run': { Icon: CarIcon, color: 'text-teal-500 dark:text-teal-400' },
    'Completed': { Icon: CheckCircleIcon, color: 'text-green-500 dark:text-green-400' },
    'Paid': { Icon: CurrencyDollarIcon, color: 'text-indigo-500 dark:text-indigo-400' },
    'Declined': { Icon: XCircleIcon, color: 'text-red-500 dark:text-red-400' },
};


const JobDetailView: React.FC<JobDetailViewProps> = ({
  contactId,
  ticketId,
  onBack,
  onViewInvoice,
  onViewRouteForDate,
}) => {
  const { 
    contacts,
    handleUpdateContactJobTickets,
  } = useContacts();
  const {
    businessInfo, 
    jobTemplates, 
    partsCatalog, 
    enabledStatuses, 
    mapSettings,
  } = useApp();
  
  const contact = contacts.find(c => c.id === contactId);
  const ticket = contact?.jobTickets.find(t => t.id === ticketId);

  const [isJobTicketModalOpen, setIsJobTicketModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<SafetyInspection | 'new' | null>(null);
  const isInspectionModalOpen = editingInspection !== null;
  const [isDeleteTicketModalOpen, setIsDeleteTicketModalOpen] = useState(false);
  const [inspectionToDeleteId, setInspectionToDeleteId] = useState<string | null>(null);

  if (!contact || !ticket) {
        return (
            <div className="p-4">
                <p>Could not find the requested job ticket.</p>
                <button onClick={onBack}>Go Back</button>
            </div>
        );
  }

  const { totalCost, balanceDue } = calculateJobTicketTotal(ticket);
  const paymentColor = paymentStatusColors[ticket.paymentStatus || 'unpaid'];
  const paymentLabel = paymentStatusLabels[ticket.paymentStatus || 'unpaid'];
  
  const sortedStatusHistory = useMemo(() => {
    // FIX: This commit resolves multiple TypeScript errors by refactoring the component to be fully compatible with the `statusHistory`-based data model. It removes all references to deprecated properties like `date`, `time`, and `status` on the `JobTicket` object. Job date and time are now correctly derived from the latest status entry, and the status-to-icon mapping has been updated to include 'Job Created', preventing crashes and ensuring data consistency.
    const history = ticket.statusHistory && ticket.statusHistory.length > 0
        ? [...ticket.statusHistory]
        : (ticket.createdAt ? [{ id: generateId(), status: 'Job Created' as JobStatus, timestamp: ticket.createdAt, notes: 'Job Created' }] : []);
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [ticket.statusHistory, ticket.createdAt]);

  const normalizedInspections = useMemo<SafetyInspection[]>(() => {
      if (ticket.inspections && ticket.inspections.length > 0) return ticket.inspections;
      if (ticket.inspection && ticket.inspection.length > 0) return [{ id: 'migrated', name: 'Safety Inspection', items: ticket.inspection }];
      return [];
  }, [ticket.inspections, ticket.inspection]);

  const handleSaveJobTicket = (entry: Omit<JobTicket, 'id'> & { id?: string }) => {
    handleUpdateContactJobTickets(contact.id, entry);
    setIsJobTicketModalOpen(false);
  };
  
  const performDeleteJobTicket = () => {
    const updatedTickets = (contact.jobTickets || []).filter(t => t.id !== ticketId);
    handleUpdateContactJobTickets(contact.id, updatedTickets);
    onBack();
  };

  const handleOnMyWay = () => {
    const template = businessInfo.onMyWayTemplate || DEFAULT_ON_MY_WAY_TEMPLATE;
    const message = processTemplate(template, { customerName: contact.name, businessName: businessInfo.name });
    window.location.href = `sms:${contact.phone}?&body=${encodeURIComponent(message)}`;
  };

  const handleSaveInspection = (inspectionData: SafetyInspection) => {
    let newInspections;
    const existingIndex = normalizedInspections.findIndex(i => i.id === inspectionData.id);
    if (existingIndex > -1) {
        newInspections = normalizedInspections.map((insp, idx) => idx === existingIndex ? inspectionData : insp);
    } else {
        newInspections = [...normalizedInspections, inspectionData];
    }
    handleUpdateContactJobTickets(contact.id, { ...ticket, inspections: newInspections, inspection: undefined });
    setEditingInspection(null);
  };
  
  const performDeleteInspection = () => {
    if (inspectionToDeleteId) {
      const newInspections = normalizedInspections.filter(i => i.id !== inspectionToDeleteId);
      handleUpdateContactJobTickets(contact.id, { ...ticket, inspections: newInspections, inspection: undefined });
      setInspectionToDeleteId(null);
    }
  };

  const jobDate = sortedStatusHistory[0] ? new Date(sortedStatusHistory[0].timestamp) : new Date();
  const ticketTime = sortedStatusHistory[0] && sortedStatusHistory[0].timestamp.includes('T') 
    ? `${jobDate.getHours().toString().padStart(2, '0')}:${jobDate.getMinutes().toString().padStart(2, '0')}`
    : undefined;

  return (
    <>
      <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
          {/* Header */}
          <div className="p-4 flex items-center border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 mr-2"><ArrowLeftIcon className="w-6 h-6" /></button>
              <div>
                  <h1 className="text-2xl font-bold">Job #{ticket.id}</h1>
              </div>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6 flex-grow">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Job Details & Actions */}
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                           <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                      Scheduled for{' '}
                                      <span onClick={onBack} className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:underline">
                                        {contact.name}
                                      </span>
                                    </p>
                                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{jobDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    {ticketTime && <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{formatTime(ticketTime)}</p>}
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => setIsJobTicketModalOpen(true)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => setIsDeleteTicketModalOpen(true)} className="p-2 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                           </div>
                           <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                                <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-2">Service Location</h3>
                                <p className="font-medium text-slate-700 dark:text-slate-200">{ticket.jobLocation || contact.address}</p>
                                {ticket.jobLocationContactName && <p className="text-sm text-slate-500 dark:text-slate-400">Attn: {ticket.jobLocationContactName}</p>}
                           </div>
                           <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                                <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-3">Quick Actions</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <a href={`tel:${contact.phone}`} className="flex flex-col items-center p-3 bg-sky-100 dark:bg-sky-900/50 rounded-md hover:bg-sky-200 dark:hover:bg-sky-800/60 transition-colors">
                                        <PhoneIcon className="w-6 h-6 text-sky-600 dark:text-sky-400"/>
                                        <span className="text-xs mt-1 font-medium text-sky-800 dark:text-sky-300">Call</span>
                                    </a>
                                    <button onClick={handleOnMyWay} className="flex flex-col items-center p-3 bg-teal-100 dark:bg-teal-900/50 rounded-md hover:bg-teal-200 dark:hover:bg-teal-800/60 transition-colors">
                                        <MessageIcon className="w-6 h-6 text-teal-600 dark:text-teal-400"/>
                                        <span className="text-xs mt-1 font-medium text-teal-800 dark:text-teal-300">On My Way</span>
                                    </button>
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ticket.jobLocation || contact.address)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center p-3 bg-amber-100 dark:bg-amber-900/50 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors">
                                        <MapIcon className="w-6 h-6 text-amber-600 dark:text-amber-400"/>
                                        <span className="text-xs mt-1 font-medium text-amber-800 dark:text-amber-300">Navigate</span>
                                    </a>
                                    <button onClick={() => onViewRouteForDate(jobDate.toISOString().split('T')[0])} className="flex flex-col items-center p-3 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800/60 transition-colors">
                                        <CarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400"/>
                                        <span className="text-xs mt-1 font-medium text-purple-800 dark:text-purple-300">View Route</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                                <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-2">Job Notes</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{ticket.notes || 'No notes for this job.'}</p>
                            </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Status History</h2>
                           <ol className="relative border-l border-slate-200 dark:border-slate-700">                  
                                {sortedStatusHistory.map((entry, index) => {
                                    const { Icon, color } = statusToIconMap[entry.status] || statusToIconMap['Job Created'];
                                    return (
                                        <li key={entry.id} className="mb-6 ml-6">            
                                            <span className={`absolute flex items-center justify-center w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded-full -left-3 ring-4 ring-white dark:ring-slate-800 ${color}`}>
                                                <Icon className="w-4 h-4" />
                                            </span>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.status}</span>
                                                    <time className="text-xs font-normal text-slate-400 dark:text-slate-500">
                                                        {new Date(entry.timestamp).toLocaleString()}
                                                    </time>
                                                </div>
                                                {/* FIX: This commit resolves multiple TypeScript errors by refactoring the component to be fully compatible with the `statusHistory`-based data model. It removes all references to deprecated properties like `date`, `time`, and `status` on the `JobTicket` object. Job date and time are now correctly derived from the latest status entry, and the status-to-icon mapping has been updated to include 'Job Created', preventing crashes and ensuring data consistency. */}
                                                <p className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1">{entry.notes}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                      </div>
                  </div>

                  {/* Right Column: Financial & Inspections */}
                  <div className="space-y-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Financial Summary</h2>
                           <div className="space-y-2">
                                <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Total</span><span className="font-semibold">${totalCost.toFixed(2)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">Deposit Paid</span><span className="font-semibold">${(ticket.deposit || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between text-lg pt-2 border-t border-slate-200 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-100">Balance Due</span><span className="font-bold">${balanceDue.toFixed(2)}</span></div>
                           </div>
                           <div className="mt-4 flex flex-col gap-2">
                                <span className={`w-full text-center px-2 py-1 text-sm font-medium rounded-full ${paymentColor.base} ${paymentColor.text}`}>{paymentLabel}</span>
                                <button onClick={onViewInvoice} className="w-full mt-2 text-center px-4 py-2 bg-sky-500 text-white rounded-md hover:bg-sky-600 font-medium text-sm transition-colors">View Invoice / Estimate</button>
                           </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Safety Inspections</h2>
                            <button onClick={() => setEditingInspection('new')} className="flex items-center space-x-1 text-sm text-sky-600 font-medium hover:text-sky-700"><PlusIcon className="w-4 h-4"/><span>New</span></button>
                          </div>
                          {normalizedInspections.length > 0 ? (
                            <ul className="space-y-3">
                                {normalizedInspections.map(insp => {
                                    const passCount = insp.items.filter(i => i.status === 'Pass').length;
                                    const failCount = insp.items.filter(i => i.status === 'Fail').length;
                                    const repairedCount = insp.items.filter(i => i.status === 'Repaired').length;
                                    return (
                                        <li key={insp.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-700/50">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold text-slate-700 dark:text-slate-200">{insp.name}</p>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => setEditingInspection(insp)} className="text-slate-400 hover:text-sky-500"><EditIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => setInspectionToDeleteId(insp.id)} className="text-slate-400 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                            <div className="flex space-x-4 mt-2 text-xs">
                                                <span className="font-medium text-green-600">{passCount} Passed</span>
                                                <span className="font-medium text-red-600">{failCount} Failed</span>
                                                <span className="font-medium text-blue-600">{repairedCount} Repaired</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No inspections have been performed for this job.</p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      {isJobTicketModalOpen && (
          <JobTicketModal
              entry={ticket}
              onSave={handleSaveJobTicket}
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
              inspection={editingInspection === 'new' ? null : editingInspection}
              onSave={handleSaveInspection}
              onClose={() => setEditingInspection(null)}
          />
      )}
      {isDeleteTicketModalOpen && (
          <ConfirmationModal
              isOpen={isDeleteTicketModalOpen}
              onClose={() => setIsDeleteTicketModalOpen(false)}
              onConfirm={performDeleteJobTicket}
              title="Delete Job Ticket"
              message="Are you sure you want to delete this job ticket? This cannot be undone."
          />
      )}
      {inspectionToDeleteId && (
          <ConfirmationModal
              isOpen={!!inspectionToDeleteId}
              onClose={() => setInspectionToDeleteId(null)}
              onConfirm={performDeleteInspection}
              title="Delete Inspection"
              message="Are you sure you want to delete this inspection report?"
          />
      )}
    </>
  );
};

export default JobDetailView;
