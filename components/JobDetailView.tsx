import React, { useState, useMemo } from 'react';
import { Contact, JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels, DEFAULT_ON_MY_WAY_TEMPLATE, JobStatus, StatusHistoryEntry, SafetyInspection, Supplier } from '../types.ts';
import { useData } from '../contexts/DataContext.tsx';
import JobTicketModal from './JobTicketModal.tsx';
import InspectionModal from './InspectionModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import AddTripModal from './AddTripModal.tsx';
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
    mileageLogs,
    handleAddSupplierTrip,
    handleUpdateContactJobTickets,
  } = useData();
  
  const contact = contacts.find(c => c.id === contactId);
  const ticket = contact?.jobTickets.find(t => t.id === ticketId);

  const [isJobTicketModalOpen, setIsJobTicketModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<SafetyInspection | 'new' | null>(null);
  const isInspectionModalOpen = editingInspection !== null;
  const [isDeleteTicketModalOpen, setIsDeleteTicketModalOpen] = useState(false);
  const [inspectionToDeleteId, setInspectionToDeleteId] = useState<string | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);

  if (!contact || !ticket) {
        return (
            <div className="p-4">
                <p>Could not find the requested job ticket.</p>
                <button onClick={onBack}>Go Back</button>
            </div>
        );
  }

  const { subtotal, taxAmount, feeAmount, totalCost, deposit } = calculateJobTicketTotal(ticket);
  
  const hasCosts = ticket.parts.length > 0 || (ticket.laborCost && ticket.laborCost > 0);
  
  let paidAmount = 0;
  if (ticket.paymentStatus === 'paid_in_full') {
      paidAmount = totalCost;
  } else if (ticket.paymentStatus === 'deposit_paid') {
      paidAmount = deposit;
  }
  const displayBalance = totalCost - paidAmount;

  const serviceLocation = ticket.jobLocation || contact.address;
  const primaryPhone = ticket.jobLocationContactPhone || contact.phone;
  const primaryName = ticket.jobLocationContactName || contact.name;
  const hasDifferentServiceLocation = (ticket.jobLocation && ticket.jobLocation !== contact.address) || ticket.jobLocationContactName || ticket.jobLocationContactPhone;


  const template = businessInfo.onMyWayTemplate || DEFAULT_ON_MY_WAY_TEMPLATE;
  const smsBody = processTemplate(template, {
    customerName: primaryName.split(' ')[0],
    businessName: businessInfo.name || 'your technician'
  });
  const smsLink = `sms:${primaryPhone}?body=${encodeURIComponent(smsBody)}`;
  
  const normalizedInspections = useMemo<SafetyInspection[]>(() => {
    if (ticket.inspections && ticket.inspections.length > 0) {
        return ticket.inspections;
    }
    // For backward compatibility, migrate legacy inspection data
    if (ticket.inspection && ticket.inspection.length > 0) {
        return [{ id: 'migrated_inspection', name: 'Safety Inspection', items: ticket.inspection }];
    }
    return [];
  }, [ticket.inspections, ticket.inspection]);

  const jobMileage = useMemo(() => {
    return (mileageLogs || []).filter(log => log.jobId === ticket.id).sort((a,b) => a.date.localeCompare(b.date));
  }, [mileageLogs, ticket.id]);

  const handleSaveInspection = (savedInspectionData: SafetyInspection) => {
    let finalInspections: SafetyInspection[];
    if (normalizedInspections.some(i => i.id === savedInspectionData.id)) {
      finalInspections = normalizedInspections.map(i => i.id === savedInspectionData.id ? savedInspectionData : i);
    } else {
      finalInspections = [...normalizedInspections, savedInspectionData];
    }
    
    // Create a mutable copy to update
    const updatedTicket: Partial<JobTicket> = { ...ticket, inspections: finalInspections };
    
    // Explicitly delete the legacy `inspection` property to avoid `undefined` values during serialization.
    delete updatedTicket.inspection;
    
    handleUpdateContactJobTickets(contact.id, updatedTicket as JobTicket);
    setEditingInspection(null);
  };

  const performDeleteTicket = () => {
    const updatedTickets = contact.jobTickets.filter(t => t.id !== ticket.id);
    handleUpdateContactJobTickets(contact.id, updatedTickets);
    onBack();
  };

  const performDeleteInspection = () => {
    if (!inspectionToDeleteId) return;

    const finalInspections = normalizedInspections.filter(i => i.id !== inspectionToDeleteId);
    
    // Create a mutable copy to update
    const updatedTicket: Partial<JobTicket> = { ...ticket, inspections: finalInspections };
    
    // Explicitly delete the legacy `inspection` property if it exists, to keep data clean
    delete updatedTicket.inspection;
    
    handleUpdateContactJobTickets(contact.id, updatedTicket as JobTicket);
    setInspectionToDeleteId(null);
  };
  
  const statusHistory = useMemo(() => {
    const history = ticket.statusHistory || [{ id: 'fallback', status: ticket.status, timestamp: ticket.createdAt || ticket.date, duration: ticket.duration }];
    return [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [ticket.statusHistory, ticket.status, ticket.createdAt, ticket.date, ticket.duration]);
  
  const mostRecentStatus = statusHistory[0];
  const currentStatus = mostRecentStatus?.status || ticket.status;

  const routableStatuses: JobStatus[] = useMemo(() => ['Estimate Scheduled', 'Scheduled', 'In Progress'], []);

  const routeInfo = useMemo(() => {
      const isCurrentStatusRoutable = routableStatuses.includes(currentStatus);
      const relevantEntry = statusHistory.find(entry => routableStatuses.includes(entry.status));
      const date = relevantEntry ? relevantEntry.timestamp.split('T')[0] : null;
  
      return {
          isRoutable: isCurrentStatusRoutable,
          date: date,
      };
  }, [currentStatus, statusHistory, routableStatuses]);
  
  const hasTimeInStatus = mostRecentStatus.timestamp.includes('T');
  const displayDateObj = new Date(mostRecentStatus.timestamp);

  let displayableTime: string | undefined;
  if (hasTimeInStatus) {
    const hours = String(displayDateObj.getHours()).padStart(2, '0');
    const minutes = String(displayDateObj.getMinutes()).padStart(2, '0');
    displayableTime = `${hours}:${minutes}`;
  } else {
    displayableTime = ticket.time;
  }
  
  const statusColor = jobStatusColors[currentStatus];
  
  const paymentStatus = ticket.paymentStatus || 'unpaid';
  const paymentStatusColor = paymentStatusColors[paymentStatus];
  const paymentStatusLabel = paymentStatusLabels[paymentStatus];

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
                onClick={() => setIsDeleteTicketModalOpen(true)}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                title="Delete Job"
            >
                <TrashIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6 flex-grow">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Combined Job Info Card */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700">
                        <p className="font-semibold text-lg text-slate-800 dark:text-slate-100">
                            {displayDateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {displayableTime && formatTime(displayableTime)}
                            {mostRecentStatus.duration && (displayableTime ? ` • ` : '') + `Est. ${mostRecentStatus.duration} min`}
                        </p>
                        {mostRecentStatus.notes && (
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600">
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{mostRecentStatus.notes}</p>
                            </div>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-3">Ticket #{ticket.id}</p>
                    </div>

                    <div className="p-5 flex flex-wrap gap-4 border-b border-slate-200 dark:border-slate-700">
                        <div className={`flex-1 p-4 rounded-lg ${statusColor.base}`}>
                            <p className={`text-xs font-bold uppercase ${statusColor.text} opacity-75 tracking-wider`}>Job Status</p>
                            <p className={`text-lg sm:text-xl font-bold ${statusColor.text} mt-1 truncate`}>{currentStatus}</p>
                        </div>
                        <div className={`flex-1 p-4 rounded-lg ${paymentStatusColor.base}`}>
                            <p className={`text-xs font-bold uppercase ${paymentStatusColor.text} opacity-75 tracking-wider`}>Payment</p>
                            <p className={`text-lg sm:text-xl font-bold ${paymentStatusColor.text} mt-1 truncate`}>{paymentStatusLabel}</p>
                        </div>
                    </div>
                  
                  <div className="p-5 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Bill To</h4>
                        <div className="space-y-3">
                            <div className="flex items-start space-x-3">
                                <UserCircleIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                    <button
                                        onClick={onBack}
                                        className="font-semibold text-slate-700 dark:text-slate-200 text-left break-words hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors duration-150"
                                        title="View full contact details"
                                    >
                                        {contact.name}
                                    </button>
                                </div>
                            </div>
                             <div className="flex items-start space-x-3">
                                <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line break-words hover:text-sky-600 dark:hover:text-sky-400">{contact.address || 'No address'}</a>
                            </div>
                        </div>
                    </div>
                    {hasDifferentServiceLocation && (
                         <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Service Location</h4>
                             <div className="space-y-3">
                                {(ticket.jobLocationContactName) && (
                                     <div className="flex items-start space-x-3">
                                        <UserCircleIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                        <p className="font-semibold text-slate-700 dark:text-slate-200 break-words">{ticket.jobLocationContactName}</p>
                                    </div>
                                )}
                                {(ticket.jobLocation && ticket.jobLocation !== contact.address) && (
                                    <div className="flex items-start space-x-3">
                                        <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.jobLocation)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line break-words hover:text-sky-600 dark:hover:text-sky-400">{ticket.jobLocation}</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 p-3 rounded-b-lg">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                          <div 
                              className="relative" 
                              title={!routeInfo.isRoutable ? `Routing is not available for jobs with '${currentStatus}' status.` : (routeInfo.date ? `View route for ${new Date(routeInfo.date + 'T00:00:00').toLocaleDateString()}` : 'No routable date found')}
                            >
                              <button
                                  onClick={() => routeInfo.isRoutable && routeInfo.date && onViewRouteForDate(routeInfo.date)}
                                  disabled={!routeInfo.isRoutable || !routeInfo.date}
                                  className="w-full flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900/20 hover:border-slate-300 dark:hover:border-slate-500 transition-all group text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-600"
                              >
                                  <MapIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 mb-1 group-hover:scale-110 transition-transform" />
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-200 leading-tight text-center">View Route</span>
                              </button>
                            </div>
                      </div>
                  </div>
              </div>
              
              {/* 2. Job Timeline */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Job Timeline</h3>
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
                                    <div>
                                      <p className={`text-sm font-medium ${index === 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{entry.status}</p>
                                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                          {new Date(entry.timestamp).toLocaleString(undefined, {
                                              year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                          })}
                                          {entry.duration && ` • ${entry.duration} min`}
                                      </p>
                                    </div>
                                </div>
                                {entry.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md border border-slate-200 dark:border-slate-700 whitespace-pre-wrap break-words">{entry.notes}</p>}
                            </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
               {/* 3. Mileage Card */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center">
                          <CarIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
                          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Mileage & Trips</h3>
                      </div>
                       <button
                          onClick={() => setIsTripModalOpen(true)}
                          disabled={!businessInfo.suppliers || businessInfo.suppliers.length === 0}
                          className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!businessInfo.suppliers || businessInfo.suppliers.length === 0 ? "Add suppliers in Settings to enable this" : "Add a trip to a supplier"}
                      >
                          <PlusIcon className="w-4 h-4" />
                          <span>Add Trip</span>
                      </button>
                  </div>
                   {jobMileage.length > 0 ? (
                      <ul className="space-y-3">
                          {jobMileage.map(log => (
                              <li key={log.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                  <div className="flex justify-between items-start">
                                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex-grow pr-2">{log.notes}</p>
                                      <p className="font-bold text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">{log.distance} mi</p>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.startAddress} &rarr; {log.endAddress}</p>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <p className="text-sm text-center text-slate-500 dark:text-slate-400 italic py-4">No special trips logged for this job.</p>
                  )}
              </div>

              {/* 4. Safety Inspection Card */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center">
                          <ClipboardCheckIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
                          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Safety Inspections</h3>
                      </div>
                  </div>
                  
                  {normalizedInspections.length > 0 ? (
                      <div className="space-y-4">
                          {normalizedInspections.map(inspection => {
                              const total = inspection.items.length;
                              const failed = inspection.items.filter(i => i.status === 'Fail').length;
                              const repaired = inspection.items.filter(i => i.status === 'Repaired').length;
                              const passed = inspection.items.filter(i => i.status === 'Pass').length;
                              return (
                                  <div key={inspection.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-slate-700 dark:text-slate-200">{inspection.name}</h4>
                                          <div className="flex items-center space-x-2">
                                              <button onClick={() => setEditingInspection(inspection)} className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline">Edit</button>
                                              <span className="text-slate-300 dark:text-slate-600">|</span>
                                              <button onClick={() => setInspectionToDeleteId(inspection.id)} className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline">Delete</button>
                                          </div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                                          <div className="bg-red-100 dark:bg-red-900/30 p-1 rounded">
                                              <p className="text-lg font-bold text-red-600 dark:text-red-400">{failed}</p>
                                              <p className="text-[10px] text-red-600 dark:text-red-300 uppercase font-bold">Fail</p>
                                          </div>
                                          <div className="bg-blue-100 dark:bg-blue-900/30 p-1 rounded">
                                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{repaired}</p>
                                              <p className="text-[10px] text-blue-600 dark:text-blue-300 uppercase font-bold">Repaired</p>
                                          </div>
                                          <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded">
                                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{passed}</p>
                                              <p className="text-[10px] text-green-600 dark:text-green-300 uppercase font-bold">Pass</p>
                                          </div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  ) : (
                      <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-6 text-center border border-dashed border-slate-300 dark:border-slate-600">
                          <p className="text-slate-500 dark:text-slate-400 mb-3 text-sm">No inspections recorded for this job.</p>
                      </div>
                  )}
                  <button 
                      onClick={() => setEditingInspection('new')}
                      className="w-full mt-4 flex items-center justify-center space-x-2 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                  >
                      <PlusIcon className="w-4 h-4" />
                      <span>Add Inspection</span>
                  </button>
              </div>


              {/* 5. Costs Card */}
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

              {/* 6. Work Notes Card */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4 border-b dark:border-slate-700 pb-3">
                      <ClipboardListIcon className="w-6 h-6 text-slate-600 dark:text-slate-300 mr-3" />
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Work Notes</h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-base whitespace-pre-wrap break-words">
                      {ticket.notes || 'No notes provided for this job.'}
                  </p>
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
          inspection={editingInspection === 'new' ? null : editingInspection}
          onSave={handleSaveInspection}
          onClose={() => setEditingInspection(null)}
        />
      )}
      
      {isDeleteTicketModalOpen && (
        <ConfirmationModal
          isOpen={isDeleteTicketModalOpen}
          onClose={() => setIsDeleteTicketModalOpen(false)}
          onConfirm={performDeleteTicket}
          title="Delete Job Ticket"
          message="Are you sure you want to delete this job ticket? This action cannot be undone."
        />
      )}

      {inspectionToDeleteId && (
        <ConfirmationModal
          isOpen={!!inspectionToDeleteId}
          onClose={() => setInspectionToDeleteId(null)}
          onConfirm={performDeleteInspection}
          title="Delete Inspection"
          message="Are you sure you want to delete this inspection? This action cannot be undone."
        />
      )}

      {isTripModalOpen && (
        <AddTripModal
            isOpen={isTripModalOpen}
            onClose={() => setIsTripModalOpen(false)}
            onSave={(data) => {
                handleAddSupplierTrip(ticket, data);
                setIsTripModalOpen(false);
            }}
            job={ticket}
            suppliers={businessInfo.suppliers || []}
        />
      )}
    </>
  );
};
