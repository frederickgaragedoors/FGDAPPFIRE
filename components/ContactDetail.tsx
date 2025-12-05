import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Contact, FileAttachment, JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels, DoorProfile, StatusHistoryEntry, JobStatus, SafetyInspection, Quote, QuoteStatus } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { useNavigation } from '../contexts/NavigationContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import PhotoGalleryModal from './PhotoGalleryModal.tsx';
import JobTicketModal from './JobTicketModal.tsx';
import EmptyState from './EmptyState.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import {
  PhoneIcon,
  MailIcon,
  MessageIcon,
  MapPinIcon,
  EditIcon,
  TrashIcon,
  FileIcon,
  ArrowLeftIcon,
  TagIcon,
  EyeIcon,
  PlusIcon,
  CameraIcon,
  BriefcaseIcon,
  ClipboardListIcon,
  HomeIcon,
  PinIcon,
  PinSolidIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  PrinterIcon,
  ClipboardDocumentListIcon,
} from './icons.tsx';
import { fileToDataUrl, formatFileSize, getInitials, generateId, calculateJobTicketTotal, formatTime, formatPhoneNumber } from '../utils.ts';

interface ContactDetailProps {
    contact: Contact;
    onEdit: () => void;
    onClose: () => void;
    onViewInvoice: (contactId: string, ticketId: string) => void;
    onViewJobDetail: (contactId: string, ticketId: string) => void;
    initialJobDate?: string;
    openJobId?: string;
}

const ContactDetail: React.FC<ContactDetailProps> = ({ 
    contact, 
    onEdit, 
    onClose, 
    onViewInvoice, 
    onViewJobDetail, 
    initialJobDate, 
    openJobId,
}) => {
    const {
        handleAddFilesToContact,
        handleUpdateContactJobTickets,
        handleDeleteContact,
        handleTogglePinContact,
        handleDeleteQuote,
    } = useContacts();
    const { 
        defaultFields, jobTemplates, partsCatalog, enabledStatuses, businessInfo, showContactPhotos, mapSettings 
    } = useApp();
    const { setViewState } = useNavigation();
    const { addNotification } = useNotifications();
    
    const [activeTab, setActiveTab] = useState<'details' | 'quotes' | 'profiles' | 'files'>('details');
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
    const [showPhotoOptions, setShowPhotoOptions] = useState(false);
    const [isJobTicketModalOpen, setIsJobTicketModalOpen] = useState(false);
    const [editingJobTicket, setEditingJobTicket] = useState<JobTicket | null>(null);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isContactDeleteConfirmOpen, setIsContactDeleteConfirmOpen] = useState(false);
    const [isDeletingContact, setIsDeletingContact] = useState(false);
    const [jobTicketToDeleteId, setJobTicketToDeleteId] = useState<string | null>(null);
    const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
    const [jobMenuOpen, setJobMenuOpen] = useState<string | null>(null);
    const [jobModalKey, setJobModalKey] = useState(Date.now());

    const processedParamsRef = useRef<{ date?: string; id?: string }>({});

    const imageUploadRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileUploadRef = useRef<HTMLInputElement>(null);
    const jobMenuRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (jobMenuRef.current && !jobMenuRef.current.contains(event.target as Node)) {
                setJobMenuOpen(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        processedParamsRef.current = {};
    }, [contact.id]);

    useEffect(() => {
        if (initialJobDate && processedParamsRef.current.date !== initialJobDate) {
            processedParamsRef.current.date = initialJobDate;
            const actualDate = initialJobDate.split('_')[0];
            const scheduledTimestamp = new Date(`${actualDate}T09:00:00`).toISOString();
            const createdAt = new Date().toISOString();
            setEditingJobTicket({
                id: generateId(),
                statusHistory: [
                    { id: generateId(), status: 'Job Created', timestamp: createdAt },
                    { id: generateId(), status: 'Estimate Scheduled', timestamp: scheduledTimestamp }
                ],
                notes: '',
                parts: [],
                laborCost: 0,
                createdAt: createdAt,
                salesTaxRate: businessInfo?.defaultSalesTaxRate || 0,
                processingFeeRate: businessInfo?.defaultProcessingFeeRate || 0,
                jobLocation: contact.address || '',
            });
            setIsJobTicketModalOpen(true);
        } 
        
        if (openJobId && processedParamsRef.current.id !== openJobId) {
             const ticketToEdit = contact.jobTickets?.find(t => t.id === openJobId);
             if (ticketToEdit) {
                 processedParamsRef.current.id = openJobId;
                 setEditingJobTicket(ticketToEdit);
                 setIsJobTicketModalOpen(true);
             }
        }
    }, [initialJobDate, openJobId, businessInfo, contact.jobTickets, contact.address]); 

    const handleViewFile = async (file: FileAttachment) => {
        if (!file.dataUrl) return;
        window.open(file.dataUrl, '_blank');
    };
    
    const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setIsLoadingFiles(true);
            try {
                const newFileObjects: { [id: string]: File } = {};
                const newFilesPromises = Array.from(e.target.files).map(async (file: File) => {
                    const dataUrl = await fileToDataUrl(file); 
                    const newFile: FileAttachment = {
                        id: generateId(),
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        dataUrl: dataUrl,
                    };
                    newFileObjects[newFile.id] = file;
                    return newFile;
                });
                const newFiles = await Promise.all(newFilesPromises);
                await handleAddFilesToContact(contact.id, newFiles, newFileObjects);
            } catch(error) {
                console.error("Error reading files:", error);
                addNotification("There was an error processing your files.", 'error');
            } finally {
                setIsLoadingFiles(false);
            }
            if(e.target) e.target.value = '';
        }
        setShowPhotoOptions(false);
    };

    const allCustomFields = useMemo(() => {
        const fieldsToShow = [...(contact.customFields || [])];
        const existingLabels = new Set(fieldsToShow.map(cf => cf.label.toLowerCase()));

        defaultFields.forEach(df => {
            if (!existingLabels.has(df.label.toLowerCase())) {
                fieldsToShow.push({
                    id: df.id,
                    label: df.label,
                    value: '',
                });
            }
        });
        return fieldsToShow;
    }, [contact.customFields, defaultFields]);
    
    const galleryImages = useMemo(() => {
        const images: { url: string; name: string }[] = [];
        if (contact.photoUrl) {
            images.push({ url: contact.photoUrl, name: `${contact.name} (Profile)` });
        }
        (contact.files || []).forEach(file => {
            if (file.type.startsWith('image/') && file.dataUrl) {
                images.push({ url: file.dataUrl, name: file.name });
            }
        });
        return images;
    }, [contact.photoUrl, contact.name, contact.files]);
    
    const imageFiles = useMemo(() => (contact.files || []).filter(file => file.type.startsWith('image/')), [contact.files]);
    const otherFiles = useMemo(() => (contact.files || []).filter(file => !file.type.startsWith('image/')), [contact.files]);

    const openGallery = (index: number) => {
        setGalleryCurrentIndex(index);
        setIsGalleryOpen(true);
    };

    const handleSaveJobTicket = (entry: Omit<JobTicket, 'id'> & { id?: string }) => {
        handleUpdateContactJobTickets(contact.id, entry);
        setIsJobTicketModalOpen(false);
        setEditingJobTicket(null);
    };
    
    const performDeleteJobTicket = () => {
        if (!jobTicketToDeleteId) return;
        const updatedTickets = (contact.jobTickets || []).filter(ticket => ticket.id !== jobTicketToDeleteId);
        handleUpdateContactJobTickets(contact.id, updatedTickets);
        setJobTicketToDeleteId(null);
    };

    const performDeleteContact = async () => {
        setIsDeletingContact(true);
        const success = await handleDeleteContact(contact.id);
        if (success) {
            onClose();
        }
        setIsContactDeleteConfirmOpen(false);
        setIsDeletingContact(false);
    };
    
    const sortedJobTickets = useMemo(() => {
        if (!contact.jobTickets) return [];
        
        return [...contact.jobTickets]
            .map(ticket => {
                let latestTimestamp: string;
                if (ticket.statusHistory && ticket.statusHistory.length > 0) {
                    const history = [...ticket.statusHistory];
                    latestTimestamp = history.reduce((latest, entry) => {
                        return new Date(entry.timestamp) > new Date(latest) ? entry.timestamp : latest;
                    }, history[0].timestamp);
                } else {
                    latestTimestamp = ticket.createdAt || new Date(0).toISOString();
                }
    
                return { ...ticket, latestTimestamp };
            })
            .sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
    }, [contact.jobTickets]);

    const sortedQuotes = useMemo(() => {
      return [...(contact.quotes || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [contact.quotes]);

    const normalizedDoorProfiles = useMemo(() => {
        return (contact.doorProfiles || []).map(p => ({
            ...p,
            id: p.id || generateId(),
            doorInstallDate: p.doorInstallDate || 'Unknown',
            springInstallDate: p.springInstallDate || 'Unknown',
            openerInstallDate: p.openerInstallDate || 'Unknown',
            springs: p.springs || []
        }));
    }, [contact.doorProfiles]);

    const formatInstallDate = (value: string | undefined) => {
        if (!value || value === 'Unknown' || value === 'Original') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {value || '---'}
                </span>
            );
        }
        try {
            return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch(e) {
            return value;
        }
    };

    const quoteStatusColors: Record<QuoteStatus, string> = {
        Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
        Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        Accepted: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
        Declined: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 flex items-center border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 md:hidden">
                    <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-grow flex items-center space-x-3 ml-4">
                    <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate">{contact.name}</h2>
                    <button onClick={() => handleTogglePinContact(contact.id)} className="text-slate-400 hover:text-amber-500 transition-colors">
                        {contact.isPinned ? <PinSolidIcon className="w-5 h-5 text-amber-500" /> : <PinIcon className="w-5 h-5" />}
                    </button>
                </div>
                <div className="flex space-x-2">
                    <button onClick={onEdit} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"><EditIcon className="w-6 h-6" /></button>
                    <button onClick={() => setIsContactDeleteConfirmOpen(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600"><TrashIcon className="w-6 h-6" /></button>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
                    {showContactPhotos && (
                        <div className="relative w-24 h-24 flex-shrink-0 group">
                            {contact.photoUrl ? (
                                <img src={contact.photoUrl} alt={contact.name} className="w-24 h-24 rounded-full object-cover ring-2 ring-white dark:ring-slate-800" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <span className="text-3xl font-bold text-slate-500 dark:text-slate-400">{getInitials(contact.name)}</span>
                                </div>
                            )}
                            <button onClick={() => setShowPhotoOptions(!showPhotoOptions)} className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <CameraIcon className="w-8 h-8"/>
                            </button>
                            {showPhotoOptions && (
                                <div className="absolute top-full mt-2 w-48 bg-white dark:bg-slate-700 rounded-md shadow-lg border dark:border-slate-600 z-10">
                                    <input type="file" ref={imageUploadRef} onChange={handleFilesSelected} accept="image/*" className="hidden" />
                                    <input type="file" ref={cameraInputRef} onChange={handleFilesSelected} accept="image/*" capture="environment" className="hidden" />
                                    <button onClick={() => imageUploadRef.current?.click()} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Upload Photo</button>
                                    <button onClick={() => cameraInputRef.current?.click()} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Use Camera</button>
                                </div>
                            )}
                        </div>
                    )}
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                             <p>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">Email:</strong>{' '}
                                {contact.email ? (
                                <a href={`mailto:${contact.email}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                                    {contact.email}
                                </a>
                                ) : 'N/A'}
                            </p>
                            <div className="flex items-center gap-4 flex-wrap">
                                <p className="flex-shrink-0">
                                    <strong className="font-semibold text-slate-800 dark:text-slate-200">Phone:</strong> {formatPhoneNumber(contact.phone) || 'N/A'}
                                </p>
                                {contact.phone && (
                                    <div className="flex items-center space-x-2">
                                        <a href={`tel:${contact.phone}`} className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors">
                                            <PhoneIcon className="w-4 h-4" />
                                            <span>Call</span>
                                        </a>
                                        <a href={`sms:${contact.phone}`} className="flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/50 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors">
                                            <MessageIcon className="w-4 h-4" />
                                            <span>Text</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                            <p>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">Address:</strong>{' '}
                                {contact.address ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline">
                                    {contact.address}
                                </a>
                                ) : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                {allCustomFields.filter(f => f.value).length > 0 && (
                     <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            {allCustomFields.filter(f => f.value).map(field => (
                                <div key={field.id}>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{field.label}</p>
                                    <p className="mt-1 text-slate-800 dark:text-slate-200">{field.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 sm:px-6">
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {[
                            ['details', 'Job Tickets'], 
                            ['quotes', 'Quotes'],
                            ['profiles', 'Door Profiles'], 
                            ['files', 'Attachments']
                        ].map(([id, name]) => (
                            <button key={id} onClick={() => setActiveTab(id as any)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === id ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                {name}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6">
                {activeTab === 'details' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Job Tickets ({sortedJobTickets.length})</h3>
                            <button onClick={() => { setEditingJobTicket(null); setJobModalKey(Date.now()); setIsJobTicketModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                <PlusIcon className="w-4 h-4" />
                                <span>Add Job</span>
                            </button>
                        </div>
                        {sortedJobTickets.length > 0 ? (
                            <ul className="space-y-3">
                                {sortedJobTickets.map(ticket => {
                                    const { totalCost } = calculateJobTicketTotal(ticket);
                                    const latestStatusEntry = (ticket.statusHistory && ticket.statusHistory.length > 0)
                                        ? [...ticket.statusHistory].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
                                        : null;
                                    const currentStatus = latestStatusEntry ? latestStatusEntry.status : 'Job Created';
                                    const statusColor = jobStatusColors[currentStatus];
                                    const paymentColor = paymentStatusColors[ticket.paymentStatus || 'unpaid'];
                                    const paymentLabel = paymentStatusLabels[ticket.paymentStatus || 'unpaid'];
                                    
                                    let ticketTime: string | undefined;
                                    if (latestStatusEntry && latestStatusEntry.timestamp.includes('T')) {
                                        const localDate = new Date(latestStatusEntry.timestamp);
                                        ticketTime = `${localDate.getHours().toString().padStart(2, '0')}:${localDate.getMinutes().toString().padStart(2, '0')}`;
                                    }
                                    
                                    return (
                                        <li 
                                            key={ticket.id} 
                                            onClick={() => onViewJobDetail(contact.id, ticket.id)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewJobDetail(contact.id, ticket.id); }}}
                                            role="button"
                                            tabIndex={0}
                                            className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-sky-500 dark:hover:border-sky-500 transition-all outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                                <div className="flex-grow">
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        {new Date(ticket.latestTimestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                        {ticketTime && <span className="ml-2 font-medium">{formatTime(ticketTime)}</span>}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">{ticket.notes}</p>
                                                </div>
                                                <div className="flex items-center space-x-2 flex-shrink-0 self-start">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${paymentColor.base} ${paymentColor.text}`}>{paymentLabel}</span>
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor.base} ${statusColor.text}`}>{currentStatus}</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-100">${totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="relative" ref={jobMenuOpen === ticket.id ? jobMenuRef : null}>
                                                     <button onClick={(e) => { e.stopPropagation(); setJobMenuOpen(jobMenuOpen === ticket.id ? null : ticket.id); }} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                                                        <EllipsisVerticalIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                                    </button>
                                                    {jobMenuOpen === ticket.id && (
                                                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-700 rounded-md shadow-lg border dark:border-slate-600 z-10" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => { setEditingJobTicket(ticket); setIsJobTicketModalOpen(true); setJobMenuOpen(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"><PencilSquareIcon className="w-4 h-4"/>Edit Job</button>
                                                            <button onClick={() => { onViewInvoice(contact.id, ticket.id); setJobMenuOpen(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"><PrinterIcon className="w-4 h-4"/>Invoice/Estimate</button>
                                                            <div className="border-t dark:border-slate-600 my-1"></div>
                                                            <button onClick={() => { setJobTicketToDeleteId(ticket.id); setJobMenuOpen(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"><TrashIcon className="w-4 h-4"/>Delete Job</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                           <EmptyState 
                                Icon={BriefcaseIcon} 
                                title="No Jobs Yet" 
                                message="Add a job ticket to track work for this contact."
                                actionText="Add New Job"
                                onAction={() => { setEditingJobTicket(null); setJobModalKey(Date.now()); setIsJobTicketModalOpen(true); }}
                            />
                        )}
                    </div>
                )}
                {activeTab === 'quotes' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Quotes ({sortedQuotes.length})</h3>
                            <button onClick={() => setViewState({ type: 'quote_form', contactId: contact.id })} className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                <PlusIcon className="w-4 h-4" />
                                <span>New Quote</span>
                            </button>
                        </div>
                        {sortedQuotes.length > 0 ? (
                            <ul className="space-y-3">
                                {sortedQuotes.map(quote => (
                                    <li key={quote.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                            <div className="flex-grow cursor-pointer" onClick={() => setViewState({ type: 'quote_view', contactId: contact.id, quoteId: quote.id })}>
                                                <p className="font-semibold text-sky-700 dark:text-sky-400 hover:underline">{quote.title || `Quote #${quote.quoteNumber}`}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Created: {new Date(quote.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2 flex-shrink-0 self-start">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${quoteStatusColors[quote.status]}`}>{quote.status}</span>
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{quote.options.length} option{quote.options.length !== 1 && 's'}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <button onClick={() => setViewState({ type: 'quote_form', contactId: contact.id, quoteId: quote.id })} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="Edit Quote">
                                                    <PencilSquareIcon className="w-5 h-5"/>
                                                </button>
                                                <button onClick={() => setQuoteToDelete(quote)} className="p-2 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50" title="Delete Quote">
                                                    <TrashIcon className="w-5 h-5"/>
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                           <EmptyState Icon={ClipboardDocumentListIcon} title="No Quotes Yet" message="Create multi-option quotes for new installations or large repairs."/>
                        )}
                    </div>
                )}
                {activeTab === 'profiles' && (
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Door & System Profiles</h3>
                         {normalizedDoorProfiles.length > 0 ? (
                             <div className="space-y-6">
                                {normalizedDoorProfiles.map((p, idx) => (
                                    <div key={p.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">{`System ${idx + 1}`}</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Dimensions</p><p className="mt-1">{p.dimensions || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Door Type</p><p className="mt-1">{p.doorType || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Spring System</p><p className="mt-1">{p.springSystem || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase"># Springs</p><p className="mt-1">{p.springs?.length || 0}</p></div>
                                            <div className="col-span-2 md:col-span-4"><p className="text-xs font-bold text-slate-500 uppercase">Spring Sizes</p><p className="mt-1">{p.springs?.map(s => s.size).join(', ') || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Opener Brand</p><p className="mt-1">{p.openerBrand || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Opener Model</p><p className="mt-1">{p.openerModel || '---'}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Door Install</p><p className="mt-1">{formatInstallDate(p.doorInstallDate)}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Spring Install</p><p className="mt-1">{formatInstallDate(p.springInstallDate)}</p></div>
                                            <div><p className="text-xs font-bold text-slate-500 uppercase">Opener Install</p><p className="mt-1">{formatInstallDate(p.openerInstallDate)}</p></div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                         ) : (
                            <EmptyState 
                                Icon={HomeIcon} 
                                title="No System Profiles" 
                                message="Add door, spring, or opener information for this contact." 
                                actionText="Add New Profile"
                                onAction={onEdit}
                            />
                         )}
                    </div>
                )}
                {activeTab === 'files' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Attachments</h3>
                             <button onClick={() => fileUploadRef.current?.click()} className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                <PlusIcon className="w-4 h-4" /><span>Add File</span>
                            </button>
                             <input type="file" ref={fileUploadRef} onChange={handleFilesSelected} multiple className="hidden" />
                        </div>
                        {imageFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Photos ({imageFiles.length})</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                    {imageFiles.map((file, index) => (
                                        <div key={file.id} onClick={() => openGallery(index + (contact.photoUrl ? 1 : 0))} className="relative aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden cursor-pointer group">
                                            {file.dataUrl && <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover"/>}
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <EyeIcon className="w-6 h-6"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {otherFiles.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Documents ({otherFiles.length})</h4>
                                <ul className="space-y-2">
                                    {otherFiles.map(file => (
                                        <li key={file.id} onClick={() => handleViewFile(file)} className="flex items-center p-3 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <FileIcon className="w-6 h-6 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                            <div className="ml-3 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                         {imageFiles.length === 0 && otherFiles.length === 0 && (
                            <EmptyState Icon={FileIcon} title="No Attachments" message="Upload photos, PDFs, or other documents related to this contact."/>
                        )}
                    </div>
                )}
            </div>

            {isGalleryOpen && (
                <PhotoGalleryModal
                    images={galleryImages}
                    startIndex={galleryCurrentIndex}
                    onClose={() => setIsGalleryOpen(false)}
                />
            )}
            {isJobTicketModalOpen && (
                <JobTicketModal
                    key={editingJobTicket?.id || `new-${jobModalKey}`}
                    entry={editingJobTicket}
                    onSave={handleSaveJobTicket}
                    onClose={() => {
                        setIsJobTicketModalOpen(false);
                        setEditingJobTicket(null);
                    }}
                    jobTemplates={jobTemplates}
                    partsCatalog={partsCatalog}
                    enabledStatuses={enabledStatuses}
                    defaultSalesTaxRate={businessInfo.defaultSalesTaxRate}
                    defaultProcessingFeeRate={businessInfo.defaultProcessingFeeRate}
                    contactAddress={contact.address}
                    apiKey={mapSettings?.apiKey}
                />
            )}
            {isContactDeleteConfirmOpen && (
                <ConfirmationModal
                    isOpen={isContactDeleteConfirmOpen}
                    onClose={() => setIsContactDeleteConfirmOpen(false)}
                    onConfirm={performDeleteContact}
                    title="Delete Contact"
                    message={`Are you sure you want to delete ${contact.name}? This will also delete all associated jobs and files. This action cannot be undone.`}
                    isConfirming={isDeletingContact}
                />
            )}
             {jobTicketToDeleteId && (
                <ConfirmationModal
                    isOpen={!!jobTicketToDeleteId}
                    onClose={() => setJobTicketToDeleteId(null)}
                    onConfirm={performDeleteJobTicket}
                    title="Delete Job Ticket"
                    message="Are you sure you want to delete this job ticket? This action cannot be undone."
                />
            )}
            {quoteToDelete && (
                <ConfirmationModal
                    isOpen={!!quoteToDelete}
                    onClose={() => setQuoteToDelete(null)}
                    onConfirm={() => {
                        handleDeleteQuote(contact.id, quoteToDelete.id);
                        setQuoteToDelete(null);
                    }}
                    title="Delete Quote"
                    message={`Are you sure you want to delete the quote "${quoteToDelete.title}"? This cannot be undone.`}
                />
            )}
        </div>
    );
};

export default ContactDetail;