import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { db, storage } from '../firebase.ts';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { Contact, JobTicket, FileAttachment, Quote } from '../types.ts';
import { generateId, migrateContacts } from '../utils.ts';
import * as idb from '../db.ts';
import { useNotifications } from './NotificationContext.tsx';
import { useApp } from './AppContext.tsx';
import { useNavigation } from './NavigationContext.tsx';

// --- CONTEXT DEFINITION ---
interface ContactContextType {
    contacts: Contact[];
    handleSaveContact: (contactData: Omit<Contact, 'id' | 'lastModified'> & { id?: string }, newFileObjects: { [id: string]: File }) => Promise<void>;
    handleDeleteContact: (id: string) => Promise<boolean>;
    handleAddFilesToContact: (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => Promise<void>;
    handleUpdateContactJobTickets: (contactId: string, ticketDataOrArray: (Omit<JobTicket, "id"> & { id?: string }) | JobTicket[]) => Promise<void>;
    handleTogglePinContact: (contactId: string) => Promise<void>;
    handleSaveQuote: (contactId: string, quote: Quote) => Promise<void>;
    handleDeleteQuote: (contactId: string, quoteId: string) => Promise<void>;
    restoreContacts: (contactsToRestore: Contact[]) => Promise<void>;
}

const ContactContext = createContext<ContactContextType | null>(null);
export const useContacts = () => { const context = useContext(ContactContext); if (!context) throw new Error('useContacts must be used within a ContactProvider'); return context; };

interface ContactProviderProps {
    children: ReactNode;
}

// --- DATA PROVIDER IMPLEMENTATION ---
export const ContactProvider: React.FC<ContactProviderProps> = ({ children }) => {
    const { user, isGuestMode, setIsGlobalLoading, setGlobalLoadingMessage, handleClearRouteForDate } = useApp();
    const { viewState, setViewState } = useNavigation();
    const { addNotification } = useNotifications();
    
    const [contacts, setContacts] = useState<Contact[]>([]);
    const migrationRunRef = useRef(false);
    
    // --- DATA LOADING & SYNC ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const sContacts = await idb.getContacts();
                if (sContacts) {
                    const { migratedContacts, wasMigrated } = migrateContacts(sContacts);
                    setContacts(migratedContacts);
                    if (wasMigrated) {
                        console.log('Migrating local data to new format...');
                        await idb.putItems(idb.CONTACTS_STORE, migratedContacts);
                        addNotification('Updated local data to new format.', 'info');
                    }
                }
            } else { setContacts([]); }
        };
        loadInitialData();
    }, [isGuestMode, addNotification]);
    
    useEffect(() => {
        if (isGuestMode || !user || !db) return;

        const unsubContacts = onSnapshot(collection(db, 'users', user.uid, 'contacts'), async (snap) => {
            const serverContacts = snap.docs.map(d => d.data() as Contact);
            const { migratedContacts, wasMigrated } = migrateContacts(serverContacts);

            setContacts(migratedContacts);

            if (wasMigrated && !migrationRunRef.current) {
                migrationRunRef.current = true; // Prevent re-running migration in this session
                console.log('Migrating Firestore data...');
                addNotification('Updating app data to new format...', 'info');

                try {
                    const batch = writeBatch(db);
                    // Find only the contacts that actually changed to be efficient
                    migratedContacts.forEach((migratedContact) => {
                        const originalContact = serverContacts.find(c => c.id === migratedContact.id);
                        // A simple JSON.stringify is sufficient for detecting changes in this context
                        if (JSON.stringify(originalContact) !== JSON.stringify(migratedContact)) {
                            const docRef = doc(db, 'users', user.uid, 'contacts', migratedContact.id);
                            batch.set(docRef, migratedContact);
                        }
                    });
                    await batch.commit();
                    addNotification('Data format updated successfully!', 'success');
                } catch (error) {
                    console.error("Error during data migration:", error);
                    addNotification("Failed to update data format.", "error");
                }
            }
        });
        
        return () => { 
            unsubContacts(); 
            migrationRunRef.current = false; // Reset on user change/logout
        };
    }, [user, isGuestMode, addNotification]);

    const navigateToDetail = (contactId: string, contact: Contact) => {
        if (viewState.type === 'new_form' && viewState.initialJobDate) {
            const rawDate = viewState.initialJobDate.split('_')[0];
            const createdTicket = contact.jobTickets.find(t => {
                const latestEntry = t.statusHistory && t.statusHistory.length > 0 ? [...t.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
                return latestEntry && latestEntry.timestamp.startsWith(rawDate);
            });
            setViewState({ type: 'detail', contactId: contactId, openJobId: createdTicket?.id });
        } else { 
            setViewState({ type: 'detail', contactId: contactId }); 
        }
    };
    
    // --- CONTACTS ---
    const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'lastModified'> & { id?: string }, newFileObjects: { [id: string]: File }) => {
        const contactId = contactData.id || generateId(); const now = new Date().toISOString();
        let finalPhotoUrl = contactData.photoUrl; let finalFiles = [...(contactData.files || [])];
        
        if (!contactData.id && contactData.jobTickets && contactData.jobTickets.length > 0) {
            const datesToClear = new Set<string>();
            contactData.jobTickets.forEach(ticket => { (ticket.statusHistory || []).forEach(h => datesToClear.add(h.timestamp.split('T')[0])); });
            datesToClear.forEach(date => handleClearRouteForDate(date));
        }
        const newContact = { ...contactData, id: contactId, lastModified: now } as Contact;
        if (isGuestMode) {
            await idb.putItem(idb.CONTACTS_STORE, newContact);
            const updated = contactData.id ? contacts.map(c => c.id === contactId ? newContact : c) : [...contacts, newContact];
            setContacts(updated);
            navigateToDetail(contactId, newContact);
            return;
        }
        if (!user || !db || !storage) return;

        try {
            if (newFileObjects['profile_photo'] && finalPhotoUrl?.startsWith('data:')) {
                const photoRef = ref(storage, `users/${user.uid}/contacts/${contactId}/profile_photo`);
                await uploadBytes(photoRef, newFileObjects['profile_photo']); finalPhotoUrl = await getDownloadURL(photoRef);
            }
            const processedFiles: FileAttachment[] = await Promise.all(finalFiles.map(async file => {
                if (newFileObjects[file.id]) {
                    const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                    await uploadBytes(fileRef, newFileObjects[file.id]); return { ...file, dataUrl: await getDownloadURL(fileRef) };
                } return file;
            }));
            const contactToSave: Contact = { ...newContact, photoUrl: finalPhotoUrl, files: processedFiles };
            await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), contactToSave, { merge: true });
            navigateToDetail(contactId, contactToSave);
        } catch (error) { 
            console.error("Error saving contact:", error); 
            addNotification("Failed to save contact.", "error");
            throw error; // Re-throw to be caught by the caller for UI updates
        }
    };

    const handleDeleteContact = async (id: string): Promise<boolean> => {
        if (isGuestMode) {
            await idb.deleteItem(idb.CONTACTS_STORE, id);
            setContacts(prev => prev.filter(c => c.id !== id));
            return true;
        }
        if (!user || !db || !storage) return false;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
            const filesRef = ref(storage, `users/${user.uid}/contacts/${id}`);
            const fileList = await listAll(filesRef); await Promise.all(fileList.items.map(itemRef => deleteObject(itemRef)));
            return true;
        } catch (error) { 
            console.error("Error deleting contact:", error); 
            addNotification("Failed to delete contact.", "error"); 
            return false;
        }
    };

    const handleAddFilesToContact = async (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        let updatedFiles = [...contact.files, ...newFiles];
        if (isGuestMode) {
            const updatedContact = { ...contact, files: updatedFiles, lastModified: new Date().toISOString() };
            await idb.putItem(idb.CONTACTS_STORE, updatedContact);
            setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
            return;
        }
        if (!user || !db || !storage) return;
        try {
            const uploadedFiles = await Promise.all(newFiles.map(async file => {
                const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                await uploadBytes(fileRef, newFileObjects[file.id]); return { ...file, dataUrl: await getDownloadURL(fileRef) };
            }));
            updatedFiles = [...contact.files, ...uploadedFiles];
            await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { files: updatedFiles, lastModified: new Date().toISOString() });
        } catch (error) { 
            console.error("Error adding files:", error); 
            addNotification("Failed to add files.", "error");
            throw error;
        }
    };

    const handleUpdateContactJobTickets = async (contactId: string, ticketDataOrArray: (Omit<JobTicket, "id"> & { id?: string }) | JobTicket[]) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        let updatedTickets: JobTicket[];
        if (Array.isArray(ticketDataOrArray)) {
            updatedTickets = ticketDataOrArray;
        } else {
            const ticketData = ticketDataOrArray;
            const existingIndex = contact.jobTickets.findIndex(jt => jt.id === ticketData.id);
            if (existingIndex > -1) {
                updatedTickets = contact.jobTickets.map((jt, index) => index === existingIndex ? { ...jt, ...ticketData } as JobTicket : jt);
            } else {
                updatedTickets = [...contact.jobTickets, { ...ticketData, id: generateId(), createdAt: new Date().toISOString() } as JobTicket];
            }
        }
        const datesToClear = new Set<string>();
        updatedTickets.forEach(ticket => {
            (ticket.statusHistory || (ticket.createdAt ? [{timestamp: ticket.createdAt}] : [])).forEach(h => datesToClear.add(h.timestamp.split('T')[0]));
        });
        (contact.jobTickets || []).forEach(ticket => {
            (ticket.statusHistory || (ticket.createdAt ? [{timestamp: ticket.createdAt}] : [])).forEach(h => datesToClear.add(h.timestamp.split('T')[0]));
        });
        datesToClear.forEach(date => handleClearRouteForDate(date));

        const updatedContact = { ...contact, jobTickets: updatedTickets, lastModified: new Date().toISOString() };
        setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));

        if (isGuestMode) { 
            await idb.putItem(idb.CONTACTS_STORE, updatedContact);
        }
        else if (user && db) { await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { jobTickets: updatedTickets, lastModified: new Date().toISOString() }); }
    };

    const handleSaveQuote = async (contactId: string, quote: Quote) => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return;
        const existingIndex = (contact.quotes || []).findIndex(q => q.id === quote.id);
        let updatedQuotes;
        if (existingIndex > -1) {
            updatedQuotes = (contact.quotes || []).map(q => q.id === quote.id ? quote : q);
        } else {
            updatedQuotes = [...(contact.quotes || []), quote];
        }
        const updatedContact = { ...contact, quotes: updatedQuotes, lastModified: new Date().toISOString() };
        setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        if (isGuestMode) { await idb.putItem(idb.CONTACTS_STORE, updatedContact); }
        else if (user && db) { await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { quotes: updatedQuotes, lastModified: new Date().toISOString() }); }
    };

    const handleDeleteQuote = async (contactId: string, quoteId: string) => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact || !contact.quotes) return;
        const updatedQuotes = contact.quotes.filter(q => q.id !== quoteId);
        const updatedContact = { ...contact, quotes: updatedQuotes, lastModified: new Date().toISOString() };
        setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        if (isGuestMode) { await idb.putItem(idb.CONTACTS_STORE, updatedContact); }
        else if (user && db) { await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { quotes: updatedQuotes, lastModified: new Date().toISOString() }); }
    };

    const handleTogglePinContact = async (contactId: string) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        
        // Optimistic UI update
        const originalContacts = contacts;
        const updatedContact = { ...contact, isPinned: !contact.isPinned, lastModified: new Date().toISOString() };
        setContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));

        try {
            if (isGuestMode) { 
                await idb.putItem(idb.CONTACTS_STORE, updatedContact);
            }
            else if (user && db) { 
                await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { isPinned: updatedContact.isPinned, lastModified: updatedContact.lastModified }); 
            }
        } catch (error) {
            // Revert on failure
            setContacts(originalContacts);
            addNotification('Failed to update pin status. Please try again.', 'error');
            console.error("Error toggling pin:", error);
        }
    };

    const restoreContacts = async (contactsToRestore: Contact[]) => {
        setContacts(contactsToRestore);
        if (isGuestMode) {
            await idb.clearStore(idb.CONTACTS_STORE);
            await idb.putItems(idb.CONTACTS_STORE, contactsToRestore);
        } else if (user && db) {
            const collRef = collection(db, 'users', user.uid, 'contacts');
            const snapshot = await getDocs(collRef);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            contactsToRestore.forEach(item => batch.set(doc(db, 'users', user.uid, 'contacts', item.id), item));
            await batch.commit();
        }
    };


    const value: ContactContextType = {
        contacts,
        handleSaveContact,
        handleDeleteContact,
        handleAddFilesToContact,
        handleUpdateContactJobTickets,
        handleTogglePinContact,
        handleSaveQuote,
        handleDeleteQuote,
        restoreContacts,
    };

    return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
};