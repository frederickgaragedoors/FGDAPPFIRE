
import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase.ts';

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
import Login from './components/Login.tsx';

import { Contact, ViewState, DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, JobTicket, FileAttachment, EmailSettings, DEFAULT_EMAIL_SETTINGS, CatalogItem, MapSettings } from './types.ts';
import { generateId } from './utils.ts';

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Data State
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Settings State (Synced to one document 'settings' in Firestore)
  const [defaultFields, setDefaultFields] = useState<DefaultFieldSetting[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({ name: '', address: '', phone: '', email: '', logoUrl: '' });
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<CatalogItem[]>([]);
  const [enabledStatuses, setEnabledStatuses] = useState<Record<JobStatus, boolean>>(() => {
      const defaults = {} as Record<JobStatus, boolean>;
      ALL_JOB_STATUSES.forEach(s => defaults[s] = true);
      return defaults;
  });
  
  // Initialize Map Settings with Env Var fallback
  const [mapSettings, setMapSettings] = useState<MapSettings>(() => {
      const env = (import.meta as any).env || (window as any).process?.env || {};
      return { 
          apiKey: env.VITE_GOOGLE_MAPS_API_KEY || '', 
          homeAddress: '' 
      };
  });
  
  const [showContactPhotos, setShowContactPhotos] = useState<boolean>(true);

  // Local UI State (Not Synced)
  const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(false); // Deprecated/Local only
  const [lastAutoBackup, setLastAutoBackup] = useState<{ timestamp: string; data: string } | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [autoCalendarExportEnabled, setAutoCalendarExportEnabled] = useState<boolean>(false);
  const [contactSelectorDate, setContactSelectorDate] = useState<Date | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (Run only when user is logged in)
  useEffect(() => {
    if (!user) return;

    // A. Contacts Listener
    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const unsubContacts = onSnapshot(contactsRef, (snapshot) => {
        const loadedContacts: Contact[] = [];
        snapshot.forEach(doc => {
            loadedContacts.push(doc.data() as Contact);
        });
        setContacts(loadedContacts);
    });

    // B. Settings Listener (Single Document)
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.defaultFields) setDefaultFields(data.defaultFields);
            if (data.businessInfo) setBusinessInfo(data.businessInfo);
            if (data.emailSettings) setEmailSettings(data.emailSettings);
            if (data.jobTemplates) setJobTemplates(data.jobTemplates);
            if (data.partsCatalog) setPartsCatalog(data.partsCatalog);
            if (data.enabledStatuses) setEnabledStatuses(data.enabledStatuses);
            
            // Merge stored map settings with env var if stored key is empty
            if (data.mapSettings) {
                const env = (import.meta as any).env || (window as any).process?.env || {};
                setMapSettings({
                    ...data.mapSettings,
                    apiKey: data.mapSettings.apiKey || env.VITE_GOOGLE_MAPS_API_KEY || ''
                });
            }
            
            if (data.showContactPhotos !== undefined) setShowContactPhotos(data.showContactPhotos);
        }
    });

    return () => {
        unsubContacts();
        unsubSettings();
    };
  }, [user]);

  // 3. Theme Handling
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

  // --- Actions (Firestore Writes) ---

  // Helper to save all settings
  const saveSettings = async (updates: any) => {
      if (!user) return;

      try {
        // Handle Logo Upload if it's a new Base64 string
        if (updates.businessInfo && updates.businessInfo.logoUrl && updates.businessInfo.logoUrl.startsWith('data:')) {
            const logoRef = ref(storage, `users/${user.uid}/settings/logo_${Date.now()}`);
            const res = await fetch(updates.businessInfo.logoUrl);
            const blob = await res.blob();
            await uploadBytes(logoRef, blob);
            updates.businessInfo.logoUrl = await getDownloadURL(logoRef);
        }

        const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
        await setDoc(settingsRef, updates, { merge: true });
      } catch (error) {
          console.error("Error saving settings:", error);
          alert("Failed to save settings. Check internet connection.");
      }
  };

  const handleSaveContact = async (contactData: Omit<Contact, 'id'>) => {
    if (!user) return;
    
    let contactId = '';
    if (viewState.type === 'edit_form' && selectedContact) {
        contactId = selectedContact.id;
    } else {
        contactId = generateId();
    }

    // Prepare data for upload
    let finalPhotoUrl = contactData.photoUrl;
    let finalFiles = [...contactData.files];

    try {
        // 1. Upload Profile Photo if Base64
        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
             const photoRef = ref(storage, `users/${user.uid}/contacts/${contactId}/profile_photo_${Date.now()}`);
             const res = await fetch(finalPhotoUrl);
             const blob = await res.blob();
             await uploadBytes(photoRef, blob);
             finalPhotoUrl = await getDownloadURL(photoRef);
        }

        // 2. Upload Attachments if Base64
        const processedFiles: FileAttachment[] = [];
        for (const file of finalFiles) {
            if (file.dataUrl && file.dataUrl.startsWith('data:')) {
                 const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                 const res = await fetch(file.dataUrl);
                 const blob = await res.blob();
                 await uploadBytes(fileRef, blob);
                 const url = await getDownloadURL(fileRef);
                 processedFiles.push({ ...file, dataUrl: url });
            } else {
                processedFiles.push(file);
            }
        }

        const contactToSave: Contact = { 
            ...contactData, 
            id: contactId,
            photoUrl: finalPhotoUrl,
            files: processedFiles
        };

        // 3. Save Document
        await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), contactToSave);
        
        // Navigation
        if (viewState.type === 'edit_form') {
            setViewState({ type: 'detail', id: contactId });
        } else {
            // If coming from calendar flow
            if (viewState.type === 'new_form' && viewState.initialJobDate) {
                const createdTicket = contactToSave.jobTickets.find(t => t.date === viewState.initialJobDate);
                if (createdTicket) {
                    setViewState({ type: 'detail', id: contactId, openJobId: createdTicket.id });
                } else {
                    setViewState({ type: 'detail', id: contactId, initialJobDate: viewState.initialJobDate });
                }
            } else {
                setViewState({ type: 'detail', id: contactId });
            }
        }
    } catch (error) {
        console.error("Error saving contact:", error);
        alert("Failed to save contact to cloud. Please ensure you have upgraded your Firebase project to the Blaze plan (Free Tier available) to use Storage.");
    }
  };

  const handleDeleteContact = async (id: string) => {
      if (!user) return;
      if (window.confirm('Are you sure you want to delete this contact?')) {
          try {
              // Note: In a production app, you would list and delete all files in storage bucket for this contact
              // For now, we just delete the database record to prevent complexity
              await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
              setViewState({ type: 'list' });
          } catch (error) {
              console.error("Error deleting contact:", error);
              alert("Failed to delete contact.");
          }
      }
  };

  const handleAddFilesToContact = async (contactId: string, files: FileAttachment[]) => {
      if (!user) return;
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      try {
        const uploadedFiles: FileAttachment[] = [];
        
        // Upload each file to Firebase Storage
        for (const file of files) {
             if (file.dataUrl && file.dataUrl.startsWith('data:')) {
                 const res = await fetch(file.dataUrl);
                 const blob = await res.blob();
                 
                 const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                 await uploadBytes(fileRef, blob);
                 const downloadURL = await getDownloadURL(fileRef);
                 
                 uploadedFiles.push({
                     ...file,
                     dataUrl: downloadURL
                 });
             } else {
                 uploadedFiles.push(file);
             }
        }

        const updatedContact = { ...contact, files: [...contact.files, ...uploadedFiles] };
        await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), updatedContact);
        
      } catch (error) {
          console.error("Failed to upload files:", error);
          alert("Failed to upload attachments. Please ensure billing is enabled for Cloud Storage.");
      }
  };

  const handleUpdateContactJobTickets = async (contactId: string, jobTickets: JobTicket[]) => {
      if (!user) return;
      const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
      await updateDoc(contactRef, { jobTickets });
  };
  
  // Restore Backup (Local File Import -> Overwrite Cloud)
  const handleRestoreBackup = async (fileContent: string) => {
      if (!user) return;
      try {
          if(!window.confirm("Restoring a backup will overwrite your cloud data. Are you sure?")) return;

          const data = JSON.parse(fileContent);

          // Update Settings
          const settingsUpdates: any = {};
          if (data.defaultFields) settingsUpdates.defaultFields = data.defaultFields;
          if (data.businessInfo) settingsUpdates.businessInfo = data.businessInfo;
          if (data.emailSettings) settingsUpdates.emailSettings = data.emailSettings;
          if (data.jobTemplates) settingsUpdates.jobTemplates = data.jobTemplates;
          if (data.partsCatalog) settingsUpdates.partsCatalog = data.partsCatalog;
          if (data.enabledStatuses) settingsUpdates.enabledStatuses = data.enabledStatuses;
          if (data.mapSettings) settingsUpdates.mapSettings = data.mapSettings;
          if (data.showContactPhotos !== undefined) settingsUpdates.showContactPhotos = data.showContactPhotos;
          
          await saveSettings(settingsUpdates);
          
          // Update Contacts (Batch write ideally, but simple loop for now)
          if (data.contacts) {
              for (const c of data.contacts) {
                  await setDoc(doc(db, 'users', user.uid, 'contacts', c.id), c);
              }
          }
          
          alert('Backup restored successfully to cloud!');
      } catch (error) {
          console.error('Error restoring backup:', error);
          alert('Failed to restore backup. Invalid file format.');
      }
  };

  const appStateForBackup = { contacts, defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, showContactPhotos, mapSettings };

  const selectedContact = useMemo(() => {
    if (viewState.type === 'detail' || viewState.type === 'edit_form') {
        return contacts.find(c => c.id === viewState.id) || null;
    }
    return null;
  }, [contacts, viewState]);

  // Render
  if (authLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500">Loading...</div>;
  }

  if (!user) {
      return <Login />;
  }

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
                  onAddDefaultField={(label) => {
                      const newFields = [...defaultFields, { id: generateId(), label }];
                      setDefaultFields(newFields);
                      saveSettings({ defaultFields: newFields });
                  }}
                  onDeleteDefaultField={(id) => {
                      const newFields = defaultFields.filter(f => f.id !== id);
                      setDefaultFields(newFields);
                      saveSettings({ defaultFields: newFields });
                  }}
                  onBack={() => setViewState({ type: 'dashboard' })}
                  appStateForBackup={appStateForBackup}
                  autoBackupEnabled={autoBackupEnabled}
                  onToggleAutoBackup={setAutoBackupEnabled}
                  lastAutoBackup={lastAutoBackup}
                  onRestoreBackup={handleRestoreBackup}
                  businessInfo={businessInfo}
                  onUpdateBusinessInfo={(info) => {
                      setBusinessInfo(info);
                      saveSettings({ businessInfo: info });
                  }}
                  emailSettings={emailSettings}
                  onUpdateEmailSettings={(settings) => {
                      setEmailSettings(settings);
                      saveSettings({ emailSettings: settings });
                  }}
                  currentTheme={currentTheme}
                  onUpdateTheme={setCurrentTheme}
                  jobTemplates={jobTemplates}
                  onAddJobTemplate={(t) => {
                      const newTemplates = [...jobTemplates, { ...t, id: generateId() }];
                      setJobTemplates(newTemplates);
                      saveSettings({ jobTemplates: newTemplates });
                  }}
                  onUpdateJobTemplate={(id, t) => {
                      const newTemplates = jobTemplates.map(jt => jt.id === id ? { ...t, id } : jt);
                      setJobTemplates(newTemplates);
                      saveSettings({ jobTemplates: newTemplates });
                  }}
                  onDeleteJobTemplate={(id) => {
                      const newTemplates = jobTemplates.filter(jt => jt.id !== id);
                      setJobTemplates(newTemplates);
                      saveSettings({ jobTemplates: newTemplates });
                  }}
                  partsCatalog={partsCatalog}
                  onAddCatalogItem={(item) => {
                      const newCatalog = [...partsCatalog, { ...item, id: generateId() }];
                      setPartsCatalog(newCatalog);
                      saveSettings({ partsCatalog: newCatalog });
                  }}
                  onDeleteCatalogItem={(id) => {
                      const newCatalog = partsCatalog.filter(i => i.id !== id);
                      setPartsCatalog(newCatalog);
                      saveSettings({ partsCatalog: newCatalog });
                  }}
                  enabledStatuses={enabledStatuses}
                  onToggleJobStatus={(status, enabled) => {
                      const newStatuses = { ...enabledStatuses, [status]: enabled };
                      setEnabledStatuses(newStatuses);
                      saveSettings({ enabledStatuses: newStatuses });
                  }}
                  contacts={contacts}
                  autoCalendarExportEnabled={autoCalendarExportEnabled}
                  onToggleAutoCalendarExport={setAutoCalendarExportEnabled}
                  showContactPhotos={showContactPhotos}
                  onToggleShowContactPhotos={(enabled) => {
                      setShowContactPhotos(enabled);
                      saveSettings({ showContactPhotos: enabled });
                  }}
                  mapSettings={mapSettings}
                  onUpdateMapSettings={(settings) => {
                      setMapSettings(settings);
                      saveSettings({ mapSettings: settings });
                  }}
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
