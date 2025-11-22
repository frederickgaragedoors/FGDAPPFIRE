
import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header.tsx';
import ContactList from './components/ContactList.tsx';
import ContactDetail from './components/ContactDetail.tsx';
import ContactForm from './components/ContactForm.tsx';
import Settings from './components/Settings.tsx';
import Dashboard from './components/Dashboard.tsx';
import CalendarView from './components/CalendarView.tsx';
import InvoiceView from './components/InvoiceView.tsx';
import JobDetailView from './components/JobDetailView.tsx';
import ContactSelectorModal from './components/ContactSelectorModal.tsx';
import RouteView from './components/RouteView.tsx';
import { Contact, ViewState, DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, JobTicket, FileAttachment, EmailSettings, DEFAULT_EMAIL_SETTINGS, CatalogItem, MapSettings } from './types.ts';
import { generateId } from './utils.ts';
import { addFiles, deleteFiles, clearAndAddFiles } from './db.ts';

// Helper to generate sample data
const getSampleContacts = (): Contact[] => {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 5);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    return [
        {
            id: 'SAMPLE-1',
            name: 'Alice Johnson',
            email: 'alice.j@example.com',
            phone: '(555) 123-4567',
            address: '123 Maple Drive, Springfield',
            photoUrl: '',
            files: [],
            customFields: [],
            doorProfiles: [
                {
                    id: 'DP-1',
                    dimensions: '16x7',
                    doorType: 'Sectional',
                    springSystem: 'Torsion',
                    springSize: '.250x2x32',
                    springs: [{ id: 'S-1', size: '.250x2x32' }, { id: 'S-2', size: '.250x2x32' }],
                    openerBrand: 'LiftMaster',
                    openerModel: '8550W',
                    doorInstallDate: '2021-05-12',
                    springInstallDate: '2021-05-12',
                    openerInstallDate: '2021-05-12'
                }
            ],
            jobTickets: [
                {
                    id: 'JOB-101',
                    date: fmt(today),
                    time: '09:00',
                    status: 'In Progress',
                    notes: 'Kitchen renovation - Day 1. Demolition and prep.',
                    parts: [],
                    laborCost: 0,
                    createdAt: new Date().toISOString(),
                    salesTaxRate: 0,
                    processingFeeRate: 0
                }
            ]
        },
        {
            id: 'SAMPLE-2',
            name: 'Bob Smith',
            email: 'bob.smith@example.com',
            phone: '(555) 987-6543',
            address: '456 Oak Lane, Springfield',
            photoUrl: '',
            files: [],
            customFields: [{ id: 'CF-1', label: 'Referred By', value: 'Yelp' }],
            doorProfiles: [
                {
                    id: 'DP-2',
                    dimensions: '9x8',
                    doorType: 'One-piece',
                    springSystem: 'Extension',
                    springSize: '',
                    springs: [{ id: 'S-3', size: 'Extension 140lb' }],
                    openerBrand: 'Genie',
                    openerModel: 'Aladdin Connect',
                    doorInstallDate: 'Original',
                    springInstallDate: 'Unknown',
                    openerInstallDate: '2019-11-03'
                },
                {
                    id: 'DP-3',
                    dimensions: '16x7',
                    doorType: 'Sectional',
                    springSystem: 'Torsion',
                    springSize: '.218x1.75x28',
                    springs: [{ id: 'S-4', size: '.218x1.75x28' }],
                    openerBrand: 'Chamberlain',
                    openerModel: 'B970',
                    doorInstallDate: '2020-02-15',
                    springInstallDate: '2020-02-15',
                    openerInstallDate: '2020-02-15'
                }
            ],
            jobTickets: [
                {
                    id: 'JOB-102',
                    date: fmt(tomorrow),
                    time: '14:00',
                    status: 'Scheduled',
                    notes: 'HVAC maintenance check.',
                    parts: [{ id: 'P-1', name: 'Filter', quantity: 1, cost: 25 }],
                    laborCost: 150,
                    salesTaxRate: 8,
                    processingFeeRate: 0,
                    createdAt: new Date().toISOString()
                }
            ]
        },
         {
            id: 'SAMPLE-3',
            name: 'Charlie Brown',
            email: 'charlie.b@example.com',
            phone: '(555) 555-5555',
            address: '789 Pine Street, Springfield',
            photoUrl: '',
            files: [],
            customFields: [],
            jobTickets: [
                {
                    id: 'JOB-103',
                    date: fmt(yesterday),
                    time: '11:30',
                    status: 'Completed',
                    notes: 'Emergency plumbing repair. Replaced burst pipe.',
                    parts: [{ id: 'P-2', name: 'Copper Pipe', quantity: 2, cost: 15 }, { id: 'P-3', name: 'Fittings', quantity: 4, cost: 5 }],
                    laborCost: 200,
                    salesTaxRate: 8,
                    processingFeeRate: 2.9,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'JOB-104',
                    date: fmt(nextWeek),
                    status: 'Estimate Scheduled',
                    notes: 'Quote for bathroom remodel.',
                    parts: [],
                    laborCost: 0,
                    salesTaxRate: 0,
                    processingFeeRate: 0,
                    createdAt: new Date().toISOString()
                }
            ]
        }
    ];
};


// Helper to get initial state from local storage
const getInitialState = <T,>(key: string, defaultValue: T): T => {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Error parsing ${key}`, e);
    }
  }
  return defaultValue;
};

function App() {
  // State definitions
  const [contacts, setContacts] = useState<Contact[]>(() => {
      const saved = localStorage.getItem('contacts');
      if (saved) {
          try { 
            const parsed = JSON.parse(saved);
            // Robust check to ensure we have an array
            if(Array.isArray(parsed)) return parsed; 
          } catch(e) { console.error(e); }
      }
      return getSampleContacts();
  });

  const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
  const [defaultFields, setDefaultFields] = useState<DefaultFieldSetting[]>(() => getInitialState('defaultFields', []));
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => getInitialState('businessInfo', { name: '', address: '', phone: '', email: '', logoUrl: '' }));
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => getInitialState('emailSettings', DEFAULT_EMAIL_SETTINGS));
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>(() => getInitialState('jobTemplates', []));
  const [partsCatalog, setPartsCatalog] = useState<CatalogItem[]>(() => getInitialState('partsCatalog', []));
  const [enabledStatuses, setEnabledStatuses] = useState<Record<JobStatus, boolean>>(() => {
      const defaults = {} as Record<JobStatus, boolean>;
      ALL_JOB_STATUSES.forEach(s => defaults[s] = true);
      return getInitialState('enabledStatuses', defaults);
  });
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(() => getInitialState('autoBackupEnabled', false));
  const [lastAutoBackup, setLastAutoBackup] = useState<{ timestamp: string; data: string } | null>(() => getInitialState('lastAutoBackup', null));
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(() => getInitialState('theme', 'system'));
  const [autoCalendarExportEnabled, setAutoCalendarExportEnabled] = useState<boolean>(() => getInitialState('autoCalendarExportEnabled', false));
  const [showContactPhotos, setShowContactPhotos] = useState<boolean>(() => getInitialState('showContactPhotos', true));
  const [mapSettings, setMapSettings] = useState<MapSettings>(() => getInitialState('mapSettings', { apiKey: '', homeAddress: '' }));
  
  const [contactSelectorDate, setContactSelectorDate] = useState<Date | null>(null);

  // Persist state changes
  useEffect(() => localStorage.setItem('contacts', JSON.stringify(contacts)), [contacts]);
  useEffect(() => localStorage.setItem('defaultFields', JSON.stringify(defaultFields)), [defaultFields]);
  useEffect(() => localStorage.setItem('businessInfo', JSON.stringify(businessInfo)), [businessInfo]);
  useEffect(() => localStorage.setItem('emailSettings', JSON.stringify(emailSettings)), [emailSettings]);
  useEffect(() => localStorage.setItem('jobTemplates', JSON.stringify(jobTemplates)), [jobTemplates]);
  useEffect(() => localStorage.setItem('partsCatalog', JSON.stringify(partsCatalog)), [partsCatalog]);
  useEffect(() => localStorage.setItem('enabledStatuses', JSON.stringify(enabledStatuses)), [enabledStatuses]);
  useEffect(() => localStorage.setItem('autoBackupEnabled', JSON.stringify(autoBackupEnabled)), [autoBackupEnabled]);
  useEffect(() => localStorage.setItem('lastAutoBackup', JSON.stringify(lastAutoBackup)), [lastAutoBackup]);
  useEffect(() => localStorage.setItem('theme', JSON.stringify(currentTheme)), [currentTheme]);
  useEffect(() => localStorage.setItem('autoCalendarExportEnabled', JSON.stringify(autoCalendarExportEnabled)), [autoCalendarExportEnabled]);
  useEffect(() => localStorage.setItem('showContactPhotos', JSON.stringify(showContactPhotos)), [showContactPhotos]);
  useEffect(() => localStorage.setItem('mapSettings', JSON.stringify(mapSettings)), [mapSettings]);

  // Theme handling
  useEffect(() => {
      const applyTheme = () => {
          const isDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          if (isDark) {
              document.documentElement.classList.add('dark');
          } else {
              document.documentElement.classList.remove('dark');
          }
      };
      applyTheme();
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [currentTheme]);

  // Auto Backup Logic
  useEffect(() => {
      if (autoBackupEnabled) {
          const data = JSON.stringify({ contacts, defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, showContactPhotos, mapSettings });
          // Only update if data changed (simple string comparison for now)
          if (!lastAutoBackup || lastAutoBackup.data !== data) {
              setLastAutoBackup({ timestamp: new Date().toISOString(), data });
          }
      }
  }, [contacts, defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, showContactPhotos, mapSettings, autoBackupEnabled]); 

  // Derived state
  const selectedContact = useMemo(() => {
    if (viewState.type === 'detail' || viewState.type === 'edit_form') {
        return contacts.find(c => c.id === viewState.id) || null;
    }
    return null;
  }, [contacts, viewState]);

  // Actions
  const handleSaveContact = async (contactData: Omit<Contact, 'id'>) => {
    // 1. Save files with content to IndexedDB
    const filesToSave = contactData.files.filter(f => f.dataUrl);
    if (filesToSave.length > 0) {
        try {
            await addFiles(filesToSave);
        } catch (error) {
            console.error("Failed to save files to DB", error);
            alert("Failed to save attachments to database. Please try again.");
            return;
        }
    }

    // 2. Strip dataUrl from files before saving to state/localStorage to avoid quota limits
    const filesForState = contactData.files.map(f => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { dataUrl, ...rest } = f;
        return rest;
    });

    const cleanContactData = { ...contactData, files: filesForState };

    if (viewState.type === 'edit_form' && selectedContact) {
        const updatedContact = { ...cleanContactData, id: selectedContact.id };
        setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
        setViewState({ type: 'detail', id: selectedContact.id });
    } else {
        const newContact = { ...cleanContactData, id: generateId() };
        setContacts([...contacts, newContact]);
        
        // If we are coming from the calendar flow
        if (viewState.type === 'new_form' && viewState.initialJobDate) {
            const createdTicket = newContact.jobTickets.find(t => t.date === viewState.initialJobDate);
            if (createdTicket) {
                setViewState({ type: 'detail', id: newContact.id, openJobId: createdTicket.id });
            } else {
                setViewState({ type: 'detail', id: newContact.id, initialJobDate: viewState.initialJobDate });
            }
        } else {
            setViewState({ type: 'detail', id: newContact.id });
        }
    }
  };

  const handleDeleteContact = (id: string) => {
      if (window.confirm('Are you sure you want to delete this contact?')) {
          const contact = contacts.find(c => c.id === id);
          if (contact && contact.files) {
              deleteFiles(contact.files.map(f => f.id));
          }
          setContacts(contacts.filter(c => c.id !== id));
          setViewState({ type: 'list' });
      }
  };

  const handleAddFilesToContact = async (contactId: string, files: FileAttachment[]) => {
      try {
        await addFiles(files);
        const filesForState = files.map(f => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { dataUrl, ...rest } = f;
            return rest;
        });

        setContacts(contacts.map(c => {
            if (c.id === contactId) {
                return { ...c, files: [...c.files, ...filesForState] };
            }
            return c;
        }));
      } catch (error) {
          console.error("Failed to add files:", error);
          alert("Failed to save attachments.");
      }
  };

  const handleUpdateContactJobTickets = (contactId: string, jobTickets: JobTicket[]) => {
      setContacts(contacts.map(c => {
          if (c.id === contactId) {
              return { ...c, jobTickets };
          }
          return c;
      }));
  };
  
  const handleRestoreBackup = async (fileContent: string) => {
      try {
          const data = JSON.parse(fileContent);
          if (data.files) await clearAndAddFiles(data.files);

          if (data.defaultFields) setDefaultFields(data.defaultFields);
          if (data.businessInfo) setBusinessInfo(data.businessInfo);
          if (data.emailSettings) setEmailSettings(data.emailSettings);
          if (data.jobTemplates) setJobTemplates(data.jobTemplates);
          if (data.partsCatalog) setPartsCatalog(data.partsCatalog);
          if (data.enabledStatuses) setEnabledStatuses(data.enabledStatuses);
          if (data.showContactPhotos !== undefined) setShowContactPhotos(data.showContactPhotos);
          if (data.mapSettings) setMapSettings(data.mapSettings);
          
          if (data.contacts) {
              const cleanContacts = data.contacts.map((c: Contact) => ({
                  ...c,
                  files: c.files ? c.files.map((f: FileAttachment) => {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { dataUrl, ...rest } = f;
                      return rest;
                  }) : []
              }));
              setContacts(cleanContacts);
          }
          
          alert('Backup restored successfully!');
      } catch (error) {
          console.error('Error restoring backup:', error);
          alert('Failed to restore backup. Invalid file format.');
      }
  };

  const appStateForBackup = { contacts, defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, showContactPhotos, mapSettings };

  const renderView = () => {
      switch (viewState.type) {
          case 'dashboard':
              return <Dashboard contacts={contacts} onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} />;
          case 'calendar':
              return <CalendarView 
                  contacts={contacts} 
                  onViewJob={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} 
                  onAddJob={(date) => setContactSelectorDate(date)}
              />;
          case 'route':
              return <RouteView 
                  contacts={contacts} 
                  mapSettings={mapSettings} 
                  onGoToSettings={() => setViewState({ type: 'settings' })}
                  onBack={() => setViewState({ type: 'dashboard' })}
              />;
          case 'list':
              return <ContactList 
                contacts={contacts} 
                selectedContactId={null} 
                onSelectContact={(id) => setViewState({ type: 'detail', id })}
                onAddJob={(id) => setViewState({ type: 'detail', id, initialJobDate: new Date().toISOString().split('T')[0] })}
              />;
          case 'detail':
              if (!selectedContact) return <div className="p-4">Contact not found</div>;
              return <ContactDetail 
                  key={selectedContact.id}
                  contact={selectedContact} 
                  defaultFields={defaultFields}
                  onEdit={() => setViewState({ type: 'edit_form', id: selectedContact.id })}
                  onDelete={() => handleDeleteContact(selectedContact.id)}
                  onClose={() => setViewState({ type: 'list' })}
                  addFilesToContact={handleAddFilesToContact}
                  updateContactJobTickets={handleUpdateContactJobTickets}
                  onViewInvoice={(contactId, ticketId) => setViewState({ type: 'invoice', contactId, ticketId, from: 'contact_detail' })}
                  onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })}
                  jobTemplates={jobTemplates}
                  partsCatalog={partsCatalog}
                  enabledStatuses={enabledStatuses}
                  initialJobDate={viewState.initialJobDate}
                  openJobId={viewState.openJobId}
                  businessInfo={businessInfo}
                  showContactPhotos={showContactPhotos}
                  apiKey={mapSettings.apiKey}
              />;
          case 'new_form':
              return <ContactForm 
                  onSave={handleSaveContact} 
                  onCancel={() => setViewState({ type: 'list' })} 
                  defaultFields={defaultFields} 
                  initialJobDate={viewState.initialJobDate}
                  apiKey={mapSettings.apiKey}
              />;
          case 'edit_form':
              if (!selectedContact) return <div className="p-4">Contact not found</div>;
              return <ContactForm 
                  initialContact={selectedContact} 
                  onSave={handleSaveContact} 
                  onCancel={() => setViewState({ type: 'detail', id: selectedContact.id })} 
                  defaultFields={defaultFields}
                  apiKey={mapSettings.apiKey}
              />;
          case 'settings':
              return <Settings 
                  defaultFields={defaultFields}
                  onAddDefaultField={(label) => setDefaultFields([...defaultFields, { id: generateId(), label }])}
                  onDeleteDefaultField={(id) => setDefaultFields(defaultFields.filter(f => f.id !== id))}
                  onBack={() => setViewState({ type: 'dashboard' })}
                  appStateForBackup={appStateForBackup}
                  autoBackupEnabled={autoBackupEnabled}
                  onToggleAutoBackup={setAutoBackupEnabled}
                  lastAutoBackup={lastAutoBackup}
                  onRestoreBackup={handleRestoreBackup}
                  businessInfo={businessInfo}
                  onUpdateBusinessInfo={setBusinessInfo}
                  emailSettings={emailSettings}
                  onUpdateEmailSettings={setEmailSettings}
                  currentTheme={currentTheme}
                  onUpdateTheme={setCurrentTheme}
                  jobTemplates={jobTemplates}
                  onAddJobTemplate={(t) => setJobTemplates([...jobTemplates, { ...t, id: generateId() }])}
                  onUpdateJobTemplate={(id, t) => setJobTemplates(jobTemplates.map(jt => jt.id === id ? { ...t, id } : jt))}
                  onDeleteJobTemplate={(id) => setJobTemplates(jobTemplates.filter(jt => jt.id !== id))}
                  partsCatalog={partsCatalog}
                  onAddCatalogItem={(item) => setPartsCatalog([...partsCatalog, { ...item, id: generateId() }])}
                  onDeleteCatalogItem={(id) => setPartsCatalog(partsCatalog.filter(i => i.id !== id))}
                  enabledStatuses={enabledStatuses}
                  onToggleJobStatus={(status, enabled) => setEnabledStatuses({ ...enabledStatuses, [status]: enabled })}
                  contacts={contacts}
                  autoCalendarExportEnabled={autoCalendarExportEnabled}
                  onToggleAutoCalendarExport={setAutoCalendarExportEnabled}
                  showContactPhotos={showContactPhotos}
                  onToggleShowContactPhotos={setShowContactPhotos}
                  mapSettings={mapSettings}
                  onUpdateMapSettings={setMapSettings}
              />;
          case 'invoice':
              const invoiceContact = contacts.find(c => c.id === viewState.contactId);
              const invoiceTicket = invoiceContact?.jobTickets.find(t => t.id === viewState.ticketId);
              if (!invoiceContact || !invoiceTicket) return <div>Job not found</div>;
              return <InvoiceView 
                  contact={invoiceContact} 
                  ticket={invoiceTicket} 
                  businessInfo={businessInfo} 
                  emailSettings={emailSettings}
                  onClose={() => {
                    if (viewState.from === 'contact_detail') {
                        setViewState({ type: 'detail', id: invoiceContact.id });
                    } else {
                        setViewState({ type: 'job_detail', contactId: invoiceContact.id, ticketId: invoiceTicket.id });
                    }
                  }}
                  addFilesToContact={handleAddFilesToContact}
              />;
          case 'job_detail':
                const jobContact = contacts.find(c => c.id === viewState.contactId);
                const jobTicket = jobContact?.jobTickets.find(t => t.id === viewState.ticketId);
                if (!jobContact || !jobTicket) return <div>Job not found</div>;
                return <JobDetailView
                    contact={jobContact}
                    ticket={jobTicket}
                    businessInfo={businessInfo}
                    jobTemplates={jobTemplates}
                    partsCatalog={partsCatalog}
                    onBack={() => setViewState({ type: 'detail', id: jobContact.id })}
                    onEditTicket={(updatedTicket) => {
                         const updatedTickets = jobContact.jobTickets.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t);
                         handleUpdateContactJobTickets(jobContact.id, updatedTickets);
                    }}
                    onDeleteTicket={() => {
                        if (window.confirm('Are you sure you want to delete this job ticket?')) {
                            const updatedTickets = jobContact.jobTickets.filter(t => t.id !== jobTicket.id);
                            handleUpdateContactJobTickets(jobContact.id, updatedTickets);
                            setViewState({ type: 'detail', id: jobContact.id });
                        }
                    }}
                    onViewInvoice={() => setViewState({ type: 'invoice', contactId: jobContact.id, ticketId: jobTicket.id, from: 'job_detail' })}
                    enabledStatuses={enabledStatuses}
                    apiKey={mapSettings.apiKey}
                />;
          default:
              return null;
      }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <style>{`
        .pac-container {
            z-index: 99999 !important;
        }
      `}</style>
      <Header 
          currentView={viewState.type} 
          onNewContact={() => setViewState({ type: 'new_form' })}
          onGoToSettings={() => setViewState({ type: 'settings' })}
          onGoToDashboard={() => setViewState({ type: 'dashboard' })}
          onGoToList={() => setViewState({ type: 'list' })}
          onGoToCalendar={() => setViewState({ type: 'calendar' })}
          onGoToRoute={() => setViewState({ type: 'route' })}
      />
      <main className="flex-grow overflow-hidden relative">
        {renderView()}
      </main>
      {contactSelectorDate && (
        <ContactSelectorModal
            contacts={contacts}
            onSelect={(contactId) => {
                setViewState({ type: 'detail', id: contactId, initialJobDate: contactSelectorDate.toISOString().split('T')[0] });
                setContactSelectorDate(null);
            }}
            onNewContact={() => {
                 setViewState({ type: 'new_form', initialJobDate: contactSelectorDate.toISOString().split('T')[0] });
                 setContactSelectorDate(null);
            }}
            onClose={() => setContactSelectorDate(null)}
            selectedDate={contactSelectorDate}
        />
      )}
    </div>
  );
}

export default App;
