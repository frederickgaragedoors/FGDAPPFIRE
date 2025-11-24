import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { FirebaseUser as User, auth, db, storage } from '../firebase.ts';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, QuerySnapshot, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Contact, ViewState, DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, JobTicket, FileAttachment, EmailSettings, DEFAULT_EMAIL_SETTINGS, CatalogItem, MapSettings, Theme } from '../types.ts';
import { generateId } from '../utils.ts';
import { generateDemoContacts } from '../demoData.ts';
import * as idb from '../db.ts';

// Helper to create a unique trigger for date-based actions to prevent effect loops
const createDateTrigger = (date: string) => `${date}_${Date.now()}`;

interface DataContextType {
    // State
    contacts: Contact[];
    defaultFields: DefaultFieldSetting[];
    businessInfo: BusinessInfo;
    emailSettings: EmailSettings;
    jobTemplates: JobTemplate[];
    partsCatalog: CatalogItem[];
    enabledStatuses: Record<JobStatus, boolean>;
    mapSettings: MapSettings;
    showContactPhotos: boolean;
    viewState: ViewState;
    selectedContact: Contact | null;
    appStateForBackup: object;
    contactSelectorDate: Date | null;
    user: User | null;
    isGuestMode: boolean;
    theme: Theme;

    // Actions
    setViewState: (viewState: ViewState) => void;
    setContactSelectorDate: (date: Date | null) => void;
    handleSaveContact: (contactData: Omit<Contact, 'id'> & { id?: string }, newFileObjects: { [id: string]: File }) => Promise<void>;
    handleDeleteContact: (id: string) => Promise<boolean>;
    handleAddFilesToContact: (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => Promise<void>;
    handleUpdateContactJobTickets: (contactId: string, ticketOrTickets: JobTicket | JobTicket[] | (Omit<JobTicket, "id"> & { id?: string })) => Promise<void>;
    saveSettings: (updates: any) => Promise<void>;
    loadDemoData: () => Promise<void>;
    onSwitchToCloud: () => void;
    restoreBackup: (fileContent: string) => Promise<void>;
    setTheme: (theme: Theme) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

interface DataProviderProps {
    user: User | null;
    isGuestMode: boolean;
    onSwitchToCloud: () => void;
    children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ user, isGuestMode, onSwitchToCloud, children }) => {
    // App Data State
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [settings, setSettings] = useState<any>({});
    
    // UI State
    const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
    const [contactSelectorDate, setContactSelectorDate] = useState<Date | null>(null);
    const [theme, setThemeState] = useState<Theme>('system');

    // Initialize theme from local storage
    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        if (storedTheme) {
            setThemeState(storedTheme);
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    // Apply Theme to document
    useEffect(() => {
        const applyTheme = () => {
            const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('dark', isDark);
        };
        applyTheme();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    // Load initial data on mode change
    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const [storedContacts, storedSettings] = await Promise.all([
                    idb.getContacts(),
                    idb.getSettings()
                ]);
                setContacts(storedContacts);
                setSettings(storedSettings || {});
            } else {
                // Cloud data is handled by Firebase listeners below
                setContacts([]);
                setSettings({});
            }
        };
        loadInitialData();
    }, [isGuestMode]);
    
    // Firebase listeners for Cloud Mode
    useEffect(() => {
        if (isGuestMode || !user || !db) {
            return; // Do nothing in guest mode or if not logged in
        }

        // Contacts Listener
        const contactsCollection = collection(db, 'users', user.uid, 'contacts');
        const unsubContacts = onSnapshot(contactsCollection, (snapshot: QuerySnapshot<DocumentData>) => {
            const loadedContacts: Contact[] = snapshot.docs.map(doc => doc.data() as Contact);
            setContacts(loadedContacts);
        });

        // Settings Listener (Single Document)
        const settingsDoc = doc(db, 'users', user.uid, 'settings', 'general');
        const unsubSettings = onSnapshot(settingsDoc, (docSnap: DocumentSnapshot<DocumentData>) => {
            setSettings(docSnap.exists() ? docSnap.data() : {});
        });

        return () => {
            unsubContacts();
            unsubSettings();
        };
    }, [user, isGuestMode]);

    // Derived settings state with defaults
    const defaultFields = useMemo(() => settings.defaultFields || [], [settings]);
    const businessInfo = useMemo(() => settings.businessInfo || { name: '', address: '', phone: '', email: '', logoUrl: '' }, [settings]);
    const emailSettings = useMemo(() => settings.emailSettings || DEFAULT_EMAIL_SETTINGS, [settings]);
    const jobTemplates = useMemo(() => settings.jobTemplates || [], [settings]);
    const partsCatalog = useMemo(() => settings.partsCatalog || [], [settings]);
    const enabledStatuses = useMemo(() => {
        const defaults = {} as Record<JobStatus, boolean>;
        ALL_JOB_STATUSES.forEach(s => defaults[s] = true);
        return settings.enabledStatuses || defaults;
    }, [settings]);
    const mapSettings = useMemo(() => {
        const envApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
        return {
            apiKey: settings.mapSettings?.apiKey || envApiKey,
            homeAddress: settings.mapSettings?.homeAddress || ''
        };
    }, [settings]);
    const showContactPhotos = useMemo(() => settings.showContactPhotos !== false, [settings]);

    const selectedContact = useMemo(() => {
        if (viewState.type === 'detail' || viewState.type === 'edit_form') {
            return contacts.find(c => c.id === viewState.id) || null;
        }
        return null;
    }, [contacts, viewState]);

    const appStateForBackup = { contacts, ...settings };

    // --- Actions ---

    const navigateToDetail = (contactId: string, contact: Contact) => {
        if (viewState.type === 'edit_form') {
            setViewState({ type: 'detail', id: contactId });
        } else if (viewState.type === 'new_form' && viewState.initialJobDate) {
            const rawDate = viewState.initialJobDate.split('_')[0];
            const createdTicket = contact.jobTickets.find(t => t.date === rawDate);
            if (createdTicket) {
                setViewState({ type: 'detail', id: contactId, openJobId: createdTicket.id });
            } else {
                setViewState({ type: 'detail', id: contactId, initialJobDate: viewState.initialJobDate });
            }
        } else {
            setViewState({ type: 'detail', id: contactId });
        }
    };

    const handleSaveContact = async (contactData: Omit<Contact, 'id'> & { id?: string }, newFileObjects: { [id: string]: File }) => {
        const contactId = contactData.id || generateId();
        let finalPhotoUrl = contactData.photoUrl;
        let finalFiles = [...(contactData.files || [])];

        if (isGuestMode) {
            const newContact = { ...contactData, id: contactId, jobTickets: contactData.jobTickets || [] } as Contact;
            const updatedContacts = contactData.id
                ? contacts.map(c => c.id === contactData.id ? newContact : c)
                : [...contacts, newContact];
            
            await idb.saveContacts(updatedContacts);
            setContacts(updatedContacts);
            navigateToDetail(contactId, newContact);
            return;
        }

        if (!user || !db || !storage) return;

        try {
            if (newFileObjects['profile_photo'] && finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
                const file = newFileObjects['profile_photo'];
                const photoRef = ref(storage, `users/${user.uid}/contacts/${contactId}/profile_photo_${Date.now()}`);
                await uploadBytes(photoRef, file);
                finalPhotoUrl = await getDownloadURL(photoRef);
            }

            const processedFiles: FileAttachment[] = [];
            for (const file of finalFiles) {
                if (newFileObjects[file.id]) {
                    const fileObj = newFileObjects[file.id];
                    const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                    await uploadBytes(fileRef, fileObj);
                    const url = await getDownloadURL(fileRef);
                    processedFiles.push({ ...file, dataUrl: url });
                } else {
                    processedFiles.push(file); // Keep existing file from cloud
                }
            }

            // Explicitly build the object to ensure all fields, especially empty arrays, are included.
            const contactToSave: Contact = {
                id: contactId,
                name: contactData.name || '',
                email: contactData.email || '',
                phone: contactData.phone || '',
                address: contactData.address || '',
                photoUrl: finalPhotoUrl || '',
                files: processedFiles,
                customFields: contactData.customFields || [],
                jobTickets: contactData.jobTickets || [], // This is the crucial fix
                doorProfiles: contactData.doorProfiles || [],
            };

            const contactDoc = doc(db, 'users', user.uid, 'contacts', contactId);
            await setDoc(contactDoc, contactToSave, { merge: true });
            navigateToDetail(contactId, contactToSave);

        } catch (error) {
            console.error("Error saving contact:", error);
            alert("Failed to save contact. Check internet connection.");
        }
    };

    const handleDeleteContact = async (id: string): Promise<boolean> => {
        const originalContacts = [...contacts];
        const contactToDelete = originalContacts.find(c => c.id === id);

        // 1. Optimistic UI Update
        const updatedContacts = originalContacts.filter(c => c.id !== id);
        setContacts(updatedContacts);

        try {
            if (isGuestMode) {
                await idb.saveContacts(updatedContacts);
            } else {
                if (!user || !db || !storage || !contactToDelete) throw new Error("User or Firebase services not available.");
                
                const contactDoc = doc(db, 'users', user.uid, 'contacts', id);
                await deleteDoc(contactDoc);
                
                const filesToDelete = [];
                if (contactToDelete.photoUrl && contactToDelete.photoUrl.includes('firebasestorage.googleapis.com')) {
                    filesToDelete.push(ref(storage, contactToDelete.photoUrl)); 
                }
                contactToDelete.files.forEach(file => {
                    if (file.dataUrl && file.dataUrl.includes('firebasestorage.googleapis.com')) {
                        filesToDelete.push(ref(storage, file.dataUrl));
                    }
                });

                await Promise.all(filesToDelete.map(fileRef => deleteObject(fileRef).catch(err => console.warn(`Failed to delete file`, err))));
            }
            return true; // Indicate success
        } catch (error) {
            console.error("Error deleting contact, rolling back UI:", error);
            alert("Failed to delete contact. Your data has been restored.");
            // 2. Rollback UI on failure
            setContacts(originalContacts);
            return false; // Indicate failure
        }
    };
    
    const handleAddFilesToContact = async (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return;
        
        if (isGuestMode) {
             const updatedContact = { ...contact, files: [...contact.files, ...newFiles] };
             const updatedContacts = contacts.map(c => c.id === contactId ? updatedContact : c);
             await idb.saveContacts(updatedContacts);
             setContacts(updatedContacts);
             return;
        }

        if (!user || !db || !storage) return;
        try {
            const uploadedFiles: FileAttachment[] = [];
            for (const file of newFiles) {
                const fileObj = newFileObjects[file.id];
                const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                await uploadBytes(fileRef, fileObj);
                const downloadURL = await getDownloadURL(fileRef);
                uploadedFiles.push({ ...file, dataUrl: downloadURL });
            }
            const updatedContact = { ...contact, files: [...contact.files, ...uploadedFiles] };
            const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
            await updateDoc(contactRef, { files: updatedContact.files });
        } catch (error) {
            console.error("Failed to upload files:", error);
            alert("Failed to upload attachments.");
        }
    };

    const handleUpdateContactJobTickets = async (contactId: string, ticketOrTickets: JobTicket | JobTicket[] | (Omit<JobTicket, "id"> & { id?: string })) => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) {
            console.error("Contact not found for job ticket update");
            return;
        }
        
        let updatedTickets: JobTicket[];
        
        if (Array.isArray(ticketOrTickets)) {
            updatedTickets = ticketOrTickets;
        } else {
             const entry = ticketOrTickets;
             const currentTickets = contact.jobTickets || [];
             if (entry.id && currentTickets.some(t => t.id === entry.id)) {
                 updatedTickets = currentTickets.map(ticket => ticket.id === entry.id ? { ...ticket, ...entry } as JobTicket : ticket);
             } else {
                 const newTicket: JobTicket = { 
                     ...entry, 
                     id: entry.id || generateId(),
                     createdAt: entry.createdAt || new Date().toISOString() 
                 } as JobTicket;
                 updatedTickets = [newTicket, ...currentTickets];
             }
        }
        
        const updatedContact = { ...contact, jobTickets: updatedTickets };

        if (isGuestMode) {
            const updatedContacts = contacts.map(c => c.id === contactId ? updatedContact : c);
            await idb.saveContacts(updatedContacts);
            setContacts(updatedContacts);
            return;
        }
        
        if (!user || !db) return;
        const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
        
        try {
            // Use setDoc to overwrite the entire document. This is more robust for PWA offline mode,
            // especially on mobile, as it avoids complex array merging logic that can fail with `updateDoc`.
            await setDoc(contactRef, updatedContact);
        } catch (error) {
            console.error("Failed to update job tickets in cloud:", error);
            alert(`Failed to save job. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const saveSettings = async (updates: any) => {
        if (isGuestMode) {
            const newSettings = { ...settings, ...updates };
            await idb.saveSettings(newSettings);
            setSettings(newSettings);
            return;
        }

        if (!user || !db || !storage) return;
        try {
            if (updates.businessInfo && updates.businessInfo.logoUrl && updates.businessInfo.logoUrl.startsWith('data:')) {
                const dataUrl = updates.businessInfo.logoUrl;
                updates.businessInfo.logoDataUrl = dataUrl; // Keep data URL for PDF generation

                const logoRef = ref(storage, `users/${user.uid}/settings/logo_${Date.now()}`);
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                await uploadBytes(logoRef, blob);
                updates.businessInfo.logoUrl = await getDownloadURL(logoRef); // Overwrite with cloud URL for display
            }
            const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
            await setDoc(settingsRef, updates, { merge: true });
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings.");
        }
    };
    
    const loadDemoData = async () => {
        if (!window.confirm("This will add 5 sample contacts. Are you sure?")) return;
        const demoContacts = generateDemoContacts();
        
        if (isGuestMode) {
            const newContacts = [...contacts, ...demoContacts];
            await idb.saveContacts(newContacts);
            setContacts(newContacts);
            alert("Demo data added.");
            setViewState({ type: 'list' });
            return;
        }
        
        if (user && db) {
            try {
                for (const contact of demoContacts) {
                    const contactRef = doc(db, 'users', user.uid, 'contacts', contact.id);
                    await setDoc(contactRef, contact);
                }
                alert("Demo data uploaded.");
                setViewState({ type: 'list' });
            } catch (e) {
                console.error(e);
                alert("Failed to upload demo data.");
            }
        }
    };

    const restoreBackup = async (fileContent: string) => {
        try {
            const data = JSON.parse(fileContent);

            // Extract Settings
            const settingsUpdates: any = {};
            if (data.defaultFields) settingsUpdates.defaultFields = data.defaultFields;
            if (data.businessInfo) settingsUpdates.businessInfo = data.businessInfo;
            if (data.emailSettings) settingsUpdates.emailSettings = data.emailSettings;
            if (data.jobTemplates) settingsUpdates.jobTemplates = data.jobTemplates;
            if (data.partsCatalog) settingsUpdates.partsCatalog = data.partsCatalog;
            if (data.enabledStatuses) settingsUpdates.enabledStatuses = data.enabledStatuses;
            if (data.mapSettings) settingsUpdates.mapSettings = data.mapSettings;
            if (data.showContactPhotos !== undefined) settingsUpdates.showContactPhotos = data.showContactPhotos;

            // Extract Contacts
            const contactsToRestore: Contact[] = data.contacts || [];

            if (isGuestMode) {
                await idb.saveSettings(settingsUpdates);
                await idb.saveContacts(contactsToRestore);
                setSettings(settingsUpdates);
                setContacts(contactsToRestore);
            } else {
                if (!user || !db) return;
                
                // Save Settings
                const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
                await setDoc(settingsRef, settingsUpdates, { merge: true });

                // Save Contacts
                for (const contact of contactsToRestore) {
                    const contactRef = doc(db, 'users', user.uid, 'contacts', contact.id);
                    await setDoc(contactRef, contact);
                }
            }
            
            alert('Backup restored successfully!');
            setViewState({ type: 'dashboard' }); // Refresh view state
        } catch (error) {
            console.error("Error restoring backup:", error);
            alert("Failed to restore backup. Invalid file format.");
        }
    };

    const value: DataContextType = {
        contacts,
        defaultFields,
        businessInfo,
        emailSettings,
        jobTemplates,
        partsCatalog,
        enabledStatuses,
        mapSettings,
        showContactPhotos,
        viewState,
        selectedContact,
        appStateForBackup,
        contactSelectorDate,
        user,
        isGuestMode,
        theme,

        setViewState,
        setContactSelectorDate,
        handleSaveContact,
        handleDeleteContact,
        handleAddFilesToContact,
        handleUpdateContactJobTickets,
        saveSettings,
        loadDemoData,
        onSwitchToCloud,
        restoreBackup,
        setTheme,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
