import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { FirebaseUser as User, db, storage } from '../firebase.ts';
// FIX: Import `getDocs` to correctly fetch documents from a collection.
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, QuerySnapshot, DocumentData, DocumentSnapshot, writeBatch, deleteField, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { GoogleGenAI, Type } from "@google/genai";
import { Contact, ViewState, DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, JobTicket, FileAttachment, EmailSettings, DEFAULT_EMAIL_SETTINGS, CatalogItem, MapSettings, Theme, Expense, BankTransaction, BankStatement, Mileage, CategorizationRule, ExpenseCategory, Supplier } from '../types.ts';
import { generateId, fileToDataUrl, calculateFileHash, getLocalDateString } from '../utils.ts';
import { generateDemoContacts } from '../demoData.ts';
import * as idb from '../db.ts';
import { useNotifications } from './NotificationContext.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

// Declare google for TS
declare const google: any;

interface DataContextType {
    // State
    contacts: Contact[];
    expenses: Expense[];
    bankTransactions: BankTransaction[];
    bankStatements: BankStatement[];
    mileageLogs: Mileage[];
    categorizationRules: CategorizationRule[];
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
    isGlobalLoading: boolean;
    globalLoadingMessage: string | null;

    // Actions
    setViewState: (viewState: ViewState) => void;
    setContactSelectorDate: (date: Date | null) => void;
    handleSaveContact: (contactData: Omit<Contact, 'id' | 'lastModified'> & { id?: string }, newFileObjects: { [id: string]: File }) => Promise<void>;
    handleDeleteContact: (id: string) => Promise<boolean>;
    handleAddFilesToContact: (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => Promise<void>;
    handleUpdateContactJobTickets: (contactId: string, ticketDataOrArray: (Omit<JobTicket, "id"> & { id?: string }) | JobTicket[]) => Promise<void>;
    handleTogglePinContact: (contactId: string) => Promise<void>;
    handleSaveExpenses: (expensesToSave: Expense[], runReconciliation?: boolean) => Promise<void>;
    handleDeleteExpense: (expenseId: string) => Promise<boolean>;
    handleImportBankStatement: (file: File) => Promise<{ success: boolean; error?: string }>;
    handleSaveBankTransactions: (transactionsToSave: BankTransaction[]) => Promise<void>;
    handleDeleteBankStatement: (statementId: string) => Promise<void>;
    handleDeleteAllBankData: () => Promise<void>;
    handleSaveMileageLog: (log: Mileage) => Promise<void>;
    handleDeleteMileageLog: (logId: string) => Promise<void>;
    importTripsForDate: (date: string, showNotifications?: boolean) => Promise<number>;
    handleAddSupplierTrip: (job: JobTicket, data: { supplier: Supplier; tripType: string; date: string; }) => Promise<void>;
    handleSaveCategorizationRules: (rules: CategorizationRule[]) => Promise<void>;
    runManualReconciliation: () => Promise<void>;
    saveSettings: (updates: any) => Promise<void>;
    loadDemoData: () => Promise<void>;
    onSwitchToCloud: () => void;
    restoreBackup: (fileContent: string) => Promise<void>;
    setTheme: (theme: Theme) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within a DataProvider');
    return context;
};

interface DataProviderProps {
    user: User | null;
    isGuestMode: boolean;
    onSwitchToCloud: () => void;
    children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ user, isGuestMode, onSwitchToCloud, children }) => {
    const { addNotification } = useNotifications();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
    const [mileageLogs, setMileageLogs] = useState<Mileage[]>([]);
    const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([]);
    const [settings, setSettings] = useState<any>({});
    const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
    const [contactSelectorDate, setContactSelectorDate] = useState<Date | null>(null);
    
    const getInitialTheme = (): Theme => (localStorage.getItem('theme') as Theme | null) || 'system';
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);
    const [globalLoadingMessage, setGlobalLoadingMessage] = useState<string | null>(null);
    const hasRunInitialMileageCheck = React.useRef(false);

    const mapSettings = useMemo(() => ({
        apiKey: settings.mapSettings?.apiKey || (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
        homeAddress: settings.mapSettings?.homeAddress || ''
    }), [settings]);

    const { isLoaded: isMapsLoaded } = useGoogleMaps(mapSettings.apiKey);

    const setTheme = (newTheme: Theme) => { setThemeState(newTheme); localStorage.setItem('theme', newTheme); };

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (localStorage.getItem('theme') === 'system') root.classList.toggle('dark', e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const [sContacts, sSettings, sExpenses, sBank, sStatements, sMileage, sRules] = await Promise.all([
                    idb.getContacts(), idb.getSettings(), idb.getExpenses(), idb.getBankTransactions(), idb.getBankStatements(), idb.getMileageLogs(), idb.getCategorizationRules()
                ]);
                setContacts(sContacts || []); setSettings(sSettings || {}); setExpenses(sExpenses || []); setBankTransactions(sBank || []); setBankStatements(sStatements || []); setMileageLogs(sMileage || []); setCategorizationRules(sRules || []);
            } else {
                setContacts([]); setSettings({}); setExpenses([]); setBankTransactions([]); setBankStatements([]); setMileageLogs([]); setCategorizationRules([]);
            }
        };
        loadInitialData();
    }, [isGuestMode]);
    
    useEffect(() => {
        if (isGuestMode || !user || !db) return;
        const unsubContacts = onSnapshot(collection(db, 'users', user.uid, 'contacts'), (snap) => setContacts(snap.docs.map(d => d.data() as Contact)));
        const unsubExpenses = onSnapshot(collection(db, 'users', user.uid, 'expenses'), (snap) => setExpenses(snap.docs.map(d => d.data() as Expense)));
        const unsubBank = onSnapshot(collection(db, 'users', user.uid, 'bankTransactions'), (snap) => setBankTransactions(snap.docs.map(d => d.data() as BankTransaction)));
        const unsubStatements = onSnapshot(collection(db, 'users', user.uid, 'bankStatements'), (snap) => setBankStatements(snap.docs.map(d => d.data() as BankStatement)));
        const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'settings', 'general'), (docSnap) => setSettings(docSnap.exists() ? docSnap.data() : {}));
        const unsubMileage = onSnapshot(collection(db, 'users', user.uid, 'mileageLogs'), (snap) => setMileageLogs(snap.docs.map(d => d.data() as Mileage)));
        const unsubRules = onSnapshot(collection(db, 'users', user.uid, 'categorizationRules'), (snap) => setCategorizationRules(snap.docs.map(d => d.data() as CategorizationRule)));
        return () => { unsubContacts(); unsubExpenses(); unsubBank(); unsubStatements(); unsubSettings(); unsubMileage(); unsubRules(); };
    }, [user, isGuestMode]);

    const defaultFields = useMemo(() => settings.defaultFields || [], [settings]);
    const businessInfo = useMemo(() => settings.businessInfo || { name: '', address: '', phone: '', email: '', logoUrl: '' }, [settings]);
    const emailSettings = useMemo(() => settings.emailSettings || DEFAULT_EMAIL_SETTINGS, [settings]);
    const jobTemplates = useMemo(() => settings.jobTemplates || [], [settings]);
    const partsCatalog = useMemo(() => settings.partsCatalog || [], [settings]);
    const enabledStatuses = useMemo(() => {
        const defaults = {} as Record<JobStatus, boolean>;
        ALL_JOB_STATUSES.forEach(s => defaults[s] = true);
        return { ...defaults, ...(settings.enabledStatuses || {}) };
    }, [settings]);
    const showContactPhotos = useMemo(() => settings.showContactPhotos !== false, [settings]);

    const selectedContact = useMemo(() => {
        if (viewState.type === 'detail' || viewState.type === 'edit_form') {
            return contacts.find(c => c.id === viewState.id) || null;
        }
        return null;
    }, [contacts, viewState]);

    const appStateForBackup = { contacts, expenses, bankTransactions, bankStatements, mileageLogs, categorizationRules, ...settings };

    const navigateToDetail = (contactId: string, contact: Contact) => {
        if (viewState.type === 'new_form' && viewState.initialJobDate) {
            const rawDate = viewState.initialJobDate.split('_')[0];
            const createdTicket = contact.jobTickets.find(t => t.date === rawDate);
            setViewState({ type: 'detail', id: contactId, openJobId: createdTicket?.id });
        } else {
            setViewState({ type: 'detail', id: contactId });
        }
    };

    const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'lastModified'> & { id?: string }, newFileObjects: { [id: string]: File }) => {
        const contactId = contactData.id || generateId();
        const now = new Date().toISOString();
        let finalPhotoUrl = contactData.photoUrl;
        let finalFiles = [...(contactData.files || [])];

        if (isGuestMode) {
            const newContact = { ...contactData, id: contactId, lastModified: now } as Contact;
            const updated = contactData.id ? contacts.map(c => c.id === contactId ? newContact : c) : [...contacts, newContact];
            await idb.saveContacts(updated); setContacts(updated); navigateToDetail(contactId, newContact); return;
        }
        if (!user || !db || !storage) return;

        try {
            if (newFileObjects['profile_photo'] && finalPhotoUrl?.startsWith('data:')) {
                const photoRef = ref(storage, `users/${user.uid}/contacts/${contactId}/profile_photo`);
                await uploadBytes(photoRef, newFileObjects['profile_photo']);
                finalPhotoUrl = await getDownloadURL(photoRef);
            }
            const processedFiles: FileAttachment[] = await Promise.all(finalFiles.map(async file => {
                if (newFileObjects[file.id]) {
                    const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                    await uploadBytes(fileRef, newFileObjects[file.id]);
                    return { ...file, dataUrl: await getDownloadURL(fileRef) };
                }
                return file;
            }));
            const contactToSave: Contact = { ...contactData, id: contactId, photoUrl: finalPhotoUrl, files: processedFiles, lastModified: now } as Contact;
            await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), contactToSave, { merge: true });
            navigateToDetail(contactId, contactToSave);
        } catch (error) { console.error("Error saving contact:", error); throw error; }
    };

    const handleDeleteContact = async (id: string): Promise<boolean> => {
        const original = [...contacts];
        const updated = original.filter(c => c.id !== id);
        setContacts(updated);
        try {
            if (isGuestMode) { await idb.saveContacts(updated); } 
            else {
                if (!user || !db) throw new Error("Not logged in");
                await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
            }
            return true;
        } catch (error) { console.error("Delete failed, rolling back:", error); setContacts(original); throw error; }
    };
    
    const handleAddFilesToContact = async (contactId: string, newFiles: FileAttachment[], newFileObjects: { [id: string]: File }) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        const now = new Date().toISOString();
        if (isGuestMode) {
             const updated = { ...contact, files: [...contact.files, ...newFiles], lastModified: now };
             const all = contacts.map(c => c.id === contactId ? updated : c);
             await idb.saveContacts(all); setContacts(all); return;
        }
        if (!user || !db || !storage) return;
        try {
            const uploadedFiles = await Promise.all(newFiles.map(async file => {
                const fileRef = ref(storage, `users/${user.uid}/contacts/${contactId}/${file.id}_${file.name}`);
                await uploadBytes(fileRef, newFileObjects[file.id]);
                return { ...file, dataUrl: await getDownloadURL(fileRef) };
            }));
            await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { files: [...contact.files, ...uploadedFiles], lastModified: now });
        } catch (error) { console.error("Failed to upload files:", error); }
    };

    const handleUpdateContactJobTickets = async (contactId: string, ticketDataOrArray: (Omit<JobTicket, "id"> & { id?: string }) | JobTicket[]) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        let finalTickets: JobTicket[];
        if (Array.isArray(ticketDataOrArray)) {
            finalTickets = ticketDataOrArray;
        } else {
            const ticketData = ticketDataOrArray;
            const existing = contact.jobTickets || [];
            finalTickets = ticketData.id ? existing.map(t => t.id === ticketData.id ? (ticketData as JobTicket) : t) : [{...ticketData, id: generateId(), createdAt: new Date().toISOString()} as JobTicket, ...existing];
        }
        const updatedContact = { ...contact, jobTickets: finalTickets, lastModified: new Date().toISOString() };
        if (isGuestMode) {
            const all = contacts.map(c => c.id === contactId ? updatedContact : c);
            await idb.saveContacts(all); setContacts(all); return;
        }
        if (user && db) await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), updatedContact);
    };

    const handleTogglePinContact = async (contactId: string) => {
        const contact = contacts.find(c => c.id === contactId); if (!contact) return;
        const updated = { ...contact, isPinned: !contact.isPinned, lastModified: new Date().toISOString() };
        if (isGuestMode) {
            const all = contacts.map(c => c.id === contactId ? updated : c);
            await idb.saveContacts(all); setContacts(all); return;
        }
        if (user && db) await updateDoc(doc(db, 'users', user.uid, 'contacts', contactId), { isPinned: updated.isPinned, lastModified: updated.lastModified });
    };

    const handleSaveExpenses = async (expensesToSave: Expense[], runRecon = true) => {
        const newExpenses = [...expenses];
        expensesToSave.forEach(expense => {
            const index = newExpenses.findIndex(e => e.id === expense.id);
            if (index > -1) newExpenses[index] = expense; else newExpenses.push(expense);
        });
        setExpenses(newExpenses);

        if (isGuestMode) { await idb.saveExpenses(newExpenses); } 
        else {
            if (user && db && storage) {
                const batch = writeBatch(db);
                const uploadPromises = expensesToSave.map(async (expense) => {
                    let finalReceiptUrl = expense.receiptUrl;
                    if (expense.receiptDataUrl?.startsWith('data:')) {
                        const res = await fetch(expense.receiptDataUrl);
                        const blob = await res.blob();
                        const receiptRef = ref(storage, `users/${user.uid}/receipts/${expense.id}`);
                        await uploadBytes(receiptRef, blob);
                        finalReceiptUrl = await getDownloadURL(receiptRef);
                    }
                    const { receiptDataUrl, ...rest } = expense;
                    batch.set(doc(db, 'users', user.uid, 'expenses', expense.id), { ...rest, receiptUrl: finalReceiptUrl });
                });
                await Promise.all(uploadPromises);
                await batch.commit();
            }
        }
        if (runRecon) runManualReconciliation();
    };

    const handleDeleteExpense = async (id: string): Promise<boolean> => {
        const original = [...expenses];
        const updated = original.filter(e => e.id !== id);
        setExpenses(updated);
        try {
            if (isGuestMode) { await idb.saveExpenses(updated); } 
            else {
                if (!user || !db) throw new Error("Not logged in");
                await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
            }
            return true;
        } catch (error) { console.error("Delete failed, rolling back:", error); setExpenses(original); return false; }
    };

    const handleImportBankStatement = async (file: File): Promise<{ success: boolean; error?: string }> => {
        if (!file.type.includes('csv') && !file.type.includes('pdf')) {
            return { success: false, error: 'Only CSV and PDF files are supported.' };
        }
    
        setIsGlobalLoading(true);
        setGlobalLoadingMessage("Analyzing statement file...");
        try {
            const fileHash = await calculateFileHash(file);
            if (bankStatements.some(s => s.fileHash === fileHash)) {
                return { success: false, error: `Statement "${file.name}" appears to be a duplicate and has already been imported.` };
            }

            setGlobalLoadingMessage("Parsing statement with AI...");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const prompt = `Parse this bank statement. Return a single JSON object with two keys: "statementPeriod" (a string like "Mon YYYY", e.g., "Oct 2025") and "transactions" (an array of transaction objects). For each transaction, identify columns for date (YYYY-MM-DD), description, and amount (debits as negative).`;
    
            let modelContents;
    
            if (file.type.includes('csv')) {
                const text = await file.text();
                modelContents = `${prompt}\n\n${text}`;
            } else { // PDF
                const dataUrl = await fileToDataUrl(file);
                const base64Data = dataUrl.split(',')[1];
                modelContents = { 
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.type, data: base64Data } }
                    ]
                };
            }
    
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: modelContents,
                config: { 
                    responseMimeType: 'application/json', 
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            statementPeriod: { type: Type.STRING, description: 'The month and year of the statement, e.g., "Oct 2025"' },
                            transactions: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        date: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        amount: { type: Type.NUMBER }
                                    },
                                    required: ['date', 'description', 'amount']
                                }
                            }
                        },
                        required: ['statementPeriod', 'transactions']
                    }
                }
            });
            
            const statementId = generateId();
            const data = JSON.parse(result.text.trim());
            const statementPeriod = data.statementPeriod;
            const transactionsData = data.transactions;

            const rules = categorizationRules || [];
            const newTransactions: BankTransaction[] = (transactionsData || []).map((t: any) => {
                let category: ExpenseCategory | undefined = undefined;
                if (rules.length > 0) {
                    for (const rule of rules) {
                        if (t.description.toLowerCase().includes(rule.keyword.toLowerCase())) {
                            category = rule.category;
                            break;
                        }
                    }
                }
                return {
                    id: generateId(),
                    date: t.date,
                    description: t.description,
                    amount: t.amount,
                    isReconciled: false,
                    createdAt: new Date().toISOString(),
                    statementId: statementId,
                    category: category,
                };
            });

            const newStatement: BankStatement = {
                id: statementId,
                fileName: file.name,
                fileHash: fileHash,
                uploadedAt: new Date().toISOString(),
                transactionCount: newTransactions.length,
                statementPeriod: statementPeriod,
            };
            
            const allTxns = [...bankTransactions, ...newTransactions];
            setBankTransactions(allTxns);
            const allStmts = [...bankStatements, newStatement];
            setBankStatements(allStmts);

            if (isGuestMode) {
                await idb.saveBankTransactions(allTxns);
                await idb.saveBankStatements(allStmts);
            } else {
                if (!user || !db) throw new Error("Not logged in");
                const batch = writeBatch(db);
                newTransactions.forEach(t => batch.set(doc(db, 'users', user.uid, 'bankTransactions', t.id), t));
                batch.set(doc(db, 'users', user.uid, 'bankStatements', newStatement.id), newStatement);
                await batch.commit();
            }
            
            await runManualReconciliation();
            return { success: true };
        } catch (error: any) {
            console.error("Bank statement parsing error:", error);
            return { success: false, error: error.message || 'Failed to parse statement with AI.' };
        } finally {
            setIsGlobalLoading(false);
            setGlobalLoadingMessage(null);
        }
    };
    
    const handleSaveBankTransactions = async (transactionsToSave: BankTransaction[]) => {
        setBankTransactions(prev => {
            const toUpdate = new Map<string, BankTransaction>(transactionsToSave.map(t => [t.id, t]));
            const newTransactions = prev.map(txn => toUpdate.get(txn.id) || txn);
            
            if (isGuestMode) {
                idb.saveBankTransactions(newTransactions);
            } else {
                if (user && db) {
                    const batch = writeBatch(db);
                    transactionsToSave.forEach(t => batch.set(doc(db, 'users', user.uid, 'bankTransactions', t.id), t, { merge: true }));
                    batch.commit();
                }
            }
            return newTransactions;
        });
    };

    const handleDeleteBankStatement = async (statementId: string) => {
        const transactionsToDelete = bankTransactions.filter(t => t.statementId === statementId).map(t => t.id);
    
        const updatedBankTransactions = bankTransactions.filter(t => t.statementId !== statementId);
        const updatedBankStatements = bankStatements.filter(s => s.id !== statementId);
        // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated logic to handle array.
        const updatedExpenses = expenses.map(e => {
            if (e.bankTransactionIds?.some(id => transactionsToDelete.includes(id))) {
                const newIds = e.bankTransactionIds.filter(id => !transactionsToDelete.includes(id));
                return { ...e, isReconciled: newIds.length > 0, bankTransactionIds: newIds };
            }
            return e;
        });
    
        setBankTransactions(updatedBankTransactions);
        setBankStatements(updatedBankStatements);
        setExpenses(updatedExpenses);
    
        if(isGuestMode) {
            await idb.saveBankTransactions(updatedBankTransactions);
            await idb.saveBankStatements(updatedBankStatements);
            await idb.saveExpenses(updatedExpenses);
        } else {
            if (!user || !db) return;
            const batch = writeBatch(db);
            batch.delete(doc(db, 'users', user.uid, 'bankStatements', statementId));
            transactionsToDelete.forEach(id => batch.delete(doc(db, 'users', user.uid, 'bankTransactions', id)));
            
            // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated logic to handle array.
            const expensesToUpdate = expenses.filter(e => e.bankTransactionIds?.some(id => transactionsToDelete.includes(id)));
            expensesToUpdate.forEach(e => {
                const newIds = e.bankTransactionIds!.filter(id => !transactionsToDelete.includes(id));
                batch.update(doc(db, 'users', user.uid, 'expenses', e.id), { 
                    isReconciled: newIds.length > 0,
                    bankTransactionIds: newIds
                });
            });
            
            await batch.commit();
        }
    };

    const handleDeleteAllBankData = async () => {
        const updatedExpenses = expenses.map(e => ({ ...e, isReconciled: false, bankTransactionId: undefined }));

        setBankStatements([]);
        setBankTransactions([]);
        setExpenses(updatedExpenses);

        if (isGuestMode) {
            await idb.saveBankStatements([]);
            await idb.saveBankTransactions([]);
            await idb.saveExpenses(updatedExpenses);
        } else {
            if (!user || !db) return;
            const batch = writeBatch(db);
            bankStatements.forEach(stmt => batch.delete(doc(db, 'users', user.uid, 'bankStatements', stmt.id)));
            bankTransactions.forEach(txn => batch.delete(doc(db, 'users', user.uid, 'bankTransactions', txn.id)));
            expenses.forEach(exp => {
                if (exp.isReconciled) {
                    batch.update(doc(db, 'users', user.uid, 'expenses', exp.id), {
                        isReconciled: false,
                        bankTransactionIds: deleteField()
                    });
                }
            });
            await batch.commit();
        }
    };
    
    const handleSaveMileageLog = async (log: Mileage) => {
        if (isGuestMode) {
            const existing = mileageLogs.find(l => l.id === log.id);
            const updatedLogs = existing ? mileageLogs.map(l => (l.id === log.id ? log : l)) : [...mileageLogs, log];
            await idb.saveMileageLogs(updatedLogs);
            setMileageLogs(updatedLogs);
        } else if (user && db) {
            await setDoc(doc(db, 'users', user.uid, 'mileageLogs', log.id), log, { merge: true });
        }
    };

    const handleDeleteMileageLog = async (logId: string) => {
        if (isGuestMode) {
            const updatedLogs = mileageLogs.filter(l => l.id !== logId);
            await idb.saveMileageLogs(updatedLogs);
            setMileageLogs(updatedLogs);
        } else if (user && db) {
            await deleteDoc(doc(db, 'users', user.uid, 'mileageLogs', logId));
        }
    };

    const handleAddSupplierTrip = async (job: JobTicket, data: { supplier: Supplier; tripType: string; date: string; }) => {
        if (!isMapsLoaded) { addNotification("Maps not loaded yet.", "error"); return; }
        
        const { supplier, tripType, date } = data;
        const jobContact = contacts.find(c => c.jobTickets.some(t => t.id === job.id));
        if (!jobContact) return;

        const customerAddress = job.jobLocation || jobContact.address;
        const homeAddress = mapSettings.homeAddress;
        
        const directionsService = new google.maps.DirectionsService();

        const createLog = async (start: string, end: string, notes: string, jobId?: string, jobContactName?: string) => {
            try {
                const result = await directionsService.route({ origin: start, destination: end, travelMode: google.maps.TravelMode.DRIVING });
                if (result.routes[0]?.legs[0]) {
                    const leg = result.routes[0].legs[0];
                    const distanceMiles = leg.distance.value / 1609.34;
                    const newLog: Mileage = { id: generateId(), date, startAddress: start, endAddress: end, distance: parseFloat(distanceMiles.toFixed(2)), notes, jobId, jobContactName };
                    await handleSaveMileageLog(newLog);
                }
            } catch (e) { console.error("Could not calculate route leg:", e); throw e; }
        };

        try {
            setIsGlobalLoading(true);
            setGlobalLoadingMessage("Calculating mileage...");
            
            if (tripType === 'before') {
                const originalTrip = mileageLogs.find(log => log.date === date && log.startAddress === homeAddress && log.endAddress === customerAddress);
                if (originalTrip) await handleDeleteMileageLog(originalTrip.id);
                
                await createLog(homeAddress, supplier.address, `Trip to supplier: ${supplier.name}`, job.id, jobContact.name);
                await createLog(supplier.address, customerAddress, `Trip from ${supplier.name} to ${jobContact.name}`, job.id, jobContact.name);
            
            } else if (tripType === 'roundtrip') {
                await createLog(customerAddress, supplier.address, `Trip to supplier: ${supplier.name}`, job.id, jobContact.name);
                await createLog(supplier.address, customerAddress, `Return from ${supplier.name} to ${jobContact.name}`, job.id, jobContact.name);
            
            } else if (tripType === 'to_supplier') {
                await createLog(customerAddress, supplier.address, `Trip to supplier: ${supplier.name}`, job.id, jobContact.name);
            
            } else if (tripType === 'from_supplier') {
                await createLog(supplier.address, customerAddress, `Trip from ${supplier.name} to ${jobContact.name}`, job.id, jobContact.name);
            }
            addNotification('Supplier trip added successfully.', 'success');
        } catch (e) {
            addNotification('Failed to calculate trip mileage. Check addresses.', 'error');
        } finally {
            setIsGlobalLoading(false);
            setGlobalLoadingMessage(null);
        }
    };

    const handleSaveCategorizationRules = async (rules: CategorizationRule[]) => {
        setCategorizationRules(rules);
        if (isGuestMode) {
            await idb.saveCategorizationRules(rules);
        } else if (user && db) {
            const batch = writeBatch(db);
            const existingRulesSnapshot = await getDocs(collection(db, 'users', user.uid, 'categorizationRules'));
            const existingRulesIds = new Set(existingRulesSnapshot.docs.map(d => d.id));
            const newRuleIds = new Set(rules.map(r => r.id));
            
            existingRulesIds.forEach(oldId => {
                if (!newRuleIds.has(oldId)) {
                    batch.delete(doc(db, 'users', user.uid, 'categorizationRules', oldId));
                }
            });

            rules.forEach(rule => {
                batch.set(doc(db, 'users', user.uid, 'categorizationRules', rule.id), rule);
            });
            await batch.commit();
        }
    };
    
    const performReconciliation = (currentExpenses: Expense[], currentBankTxns: BankTransaction[], currentBusinessInfo: BusinessInfo): { expensesToUpdate: Expense[], bankTxnsToUpdate: BankTransaction[], matchedCount: number } => {
        const expensesToUpdate: Expense[] = [];
        const bankTxnsToUpdate = [...currentBankTxns];
        let matchedCount = 0;
    
        const feeRate = (currentBusinessInfo.defaultProcessingFeeRate || 0) / 100;
        
        // Create a mutable pool of expenses that can be matched. This now includes deferred expenses.
        const availableExpenses = currentExpenses.filter(e => !e.isReconciled);
    
        // Find bank transaction indices that need matching.
        const bankTxnIndicesToReconcile = bankTxnsToUpdate
            .map((txn, index) => ({ txn, index }))
            .filter(({ txn }) => !txn.isReconciled && txn.amount < 0);
    
        for (const { txn, index: bankTxnIndex } of bankTxnIndicesToReconcile) {
            const txnDate = new Date(txn.date);
            const txnAmount = Math.abs(txn.amount);
    
            let matchedExpenseIndex = -1;
    
            // Find a matching expense from the available pool.
            for (let i = 0; i < availableExpenses.length; i++) {
                const exp = availableExpenses[i];
                const expDate = new Date(exp.date);
                const dateDiff = Math.abs(txnDate.getTime() - expDate.getTime()) / (1000 * 3600 * 24);
    
                // Increased the date window to 60 days to catch deferred payments
                if (dateDiff > 60) continue;
    
                const expectedNet = exp.total * (1 - feeRate);
                const amountDiff = Math.abs(txnAmount - expectedNet);
                const isMatch = Math.abs(txnAmount - exp.total) < 0.02 || (feeRate > 0 && amountDiff < 0.02);
    
                if (isMatch) {
                    matchedExpenseIndex = i;
                    break;
                }
            }
    
            if (matchedExpenseIndex !== -1) {
                // Remove the matched expense from the pool to prevent re-matching
                const matchedExpense = availableExpenses.splice(matchedExpenseIndex, 1)[0];
    
                const feeAmount = matchedExpense.total - txnAmount;
                if (feeRate > 0 && feeAmount > 0.01) {
                    // FIX: Replaced `bankTransactionId` with `bankTransactionIds`.
                    expensesToUpdate.push({
                        id: generateId(), vendor: matchedExpense.vendor, date: txn.date,
                        total: feeAmount, tax: 0,
                        lineItems: [{ id: generateId(), description: 'Processing Fee', amount: feeAmount, category: 'Bank & Processing Fee' }],
                        receiptUrl: '', createdAt: new Date().toISOString(),
                        isReconciled: true, bankTransactionIds: [txn.id],
                    });
                }
                
                // When matching, ensure isDeferred is set to false
                // FIX: Replaced `bankTransactionId` with `bankTransactionIds`.
                expensesToUpdate.push({ ...matchedExpense, isReconciled: true, bankTransactionIds: [txn.id], isDeferred: false });
                
                // Mark the original transaction in the copied array as reconciled
                bankTxnsToUpdate[bankTxnIndex].isReconciled = true;
                
                matchedCount++;
            }
        }
        return { expensesToUpdate, bankTxnsToUpdate, matchedCount };
    };

    const runManualReconciliation = async () => {
        setIsGlobalLoading(true);
        setGlobalLoadingMessage("Running reconciliation...");

        const { expensesToUpdate, bankTxnsToUpdate, matchedCount } = performReconciliation(expenses, bankTransactions, businessInfo);
        
        if (expensesToUpdate.length > 0) {
            await handleSaveExpenses(expensesToUpdate, false); // Reconciliation already done
        }
        if(bankTxnsToUpdate.some(bt => {
            const original = bankTransactions.find(orig => orig.id === bt.id);
            return original ? original.isReconciled !== bt.isReconciled : true;
        })) {
            setBankTransactions(bankTxnsToUpdate);
            if(isGuestMode) {
                // FIX: Pass the array directly, not as an object property.
                await idb.saveBankTransactions(bankTxnsToUpdate);
            }
            else if (user && db) {
                const batch = writeBatch(db);
                bankTxnsToUpdate.filter(bt => bt.isReconciled).forEach(t => batch.update(doc(db, 'users', user.uid, 'bankTransactions', t.id), { isReconciled: true }));
                await batch.commit();
            }
        }
        
        addNotification(matchedCount > 0 ? `Successfully reconciled ${matchedCount} items.` : 'No new matches found.', matchedCount > 0 ? 'success' : 'info');
        setIsGlobalLoading(false);
        setGlobalLoadingMessage(null);
    };

    const saveSettings = async (updates: any) => {
        if (isGuestMode) { const newSettings = { ...settings, ...updates }; await idb.saveSettings(newSettings); setSettings(newSettings); return; }
        if (!user || !db || !storage) return;
        try {
            if (updates.businessInfo?.logoUrl?.startsWith('data:')) {
                const dataUrl = updates.businessInfo.logoUrl;
                updates.businessInfo.logoDataUrl = dataUrl;
                const logoRef = ref(storage, `users/${user.uid}/settings/logo`);
                const res = await fetch(dataUrl); await uploadBytes(logoRef, await res.blob());
                updates.businessInfo.logoUrl = await getDownloadURL(logoRef);
            }
            await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), updates, { merge: true });
        } catch (error) { console.error("Error saving settings:", error); }
    };
    
    const loadDemoData = async () => {
        if (!window.confirm("Add sample contacts?")) return;
        const demo = generateDemoContacts();
        if (isGuestMode) { const all = [...contacts, ...demo]; await idb.saveContacts(all); setContacts(all); }
        else if (user && db) { for (const c of demo) await setDoc(doc(db, 'users', user.uid, 'contacts', c.id), c); }
        setViewState({ type: 'list' });
    };

    const restoreBackup = async (fileContent: string) => {
        try {
            const data = JSON.parse(fileContent);
            const { contacts: c, expenses: e, bankTransactions: b, bankStatements: bs, mileageLogs: ml, categorizationRules: cr, ...s } = data;
            const contactsToRestore = c || []; 
            const expensesToRestore = e || []; 
            const bankToRestore = b || [];
            const statementsToRestore = bs || [];
            const mileageToRestore = ml || [];
            const rulesToRestore = cr || [];
            
            if (isGuestMode) {
                await idb.saveSettings(s); await idb.saveContacts(contactsToRestore); await idb.saveExpenses(expensesToRestore); await idb.saveBankTransactions(bankToRestore); await idb.saveBankStatements(statementsToRestore); await idb.saveMileageLogs(mileageToRestore); await idb.saveCategorizationRules(rulesToRestore);
                setSettings(s); setContacts(contactsToRestore); setExpenses(expensesToRestore); setBankTransactions(bankToRestore); setBankStatements(statementsToRestore); setMileageLogs(mileageToRestore); setCategorizationRules(rulesToRestore);
            } else {
                if (!user || !db) return;
                await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), s, { merge: true });
                const batch = writeBatch(db);
                contactsToRestore.forEach((c: Contact) => batch.set(doc(db, 'users', user.uid, 'contacts', c.id), c));
                expensesToRestore.forEach((e: Expense) => batch.set(doc(db, 'users', user.uid, 'expenses', e.id), e));
                bankToRestore.forEach((b: BankTransaction) => batch.set(doc(db, 'users', user.uid, 'bankTransactions', b.id), b));
                statementsToRestore.forEach((bs: BankStatement) => batch.set(doc(db, 'users', user.uid, 'bankStatements', bs.id), bs));
                mileageToRestore.forEach((ml: Mileage) => batch.set(doc(db, 'users', user.uid, 'mileageLogs', ml.id), ml));
                rulesToRestore.forEach((cr: CategorizationRule) => batch.set(doc(db, 'users', user.uid, 'categorizationRules', cr.id), cr));
                await batch.commit();
            }
            throw new Error('Backup restored successfully!');
        } catch (error) { console.error("Restore error:", error); throw new Error("Invalid backup file."); }
    };
    
    const importTripsForDate = async (date: string, showNotifications = true): Promise<number> => {
        if (!isMapsLoaded) {
            if (showNotifications) addNotification("Maps are not loaded yet, please wait.", "info");
            return 0;
        }
        if (!mapSettings.homeAddress) {
            if (showNotifications) addNotification("Please set your Home/Base Address in settings to import trips.", "error");
            return 0;
        }

        const routableStatuses: JobStatus[] = ['Scheduled', 'Estimate Scheduled', 'In Progress'];
        const jobsForDay = new Map<string, JobTicket & { contactName: string; contactAddress: string; }>();

        for (const contact of contacts) {
            for (const ticket of contact.jobTickets) {
                const history = ticket.statusHistory || [];
                for (const entry of history) {
                    const entryDate = entry.timestamp.split('T')[0];
                    if (entryDate === date && routableStatuses.includes(entry.status)) {
                        if (!jobsForDay.has(ticket.id)) {
                             const latestHistoryForDay = history.filter(h => h.timestamp.startsWith(date)).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                            jobsForDay.set(ticket.id, { ...ticket, time: latestHistoryForDay.timestamp.includes('T') ? latestHistoryForDay.timestamp.split('T')[1].substring(0,5) : ticket.time, contactName: contact.name, contactAddress: contact.address });
                        }
                        break; 
                    }
                }
            }
        }
        
        const dailyJobs = Array.from(jobsForDay.values()).sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));

        if (dailyJobs.length === 0) {
            if (showNotifications) addNotification("No routable jobs found for this date.", "info");
            return 0;
        }

        const addresses = [mapSettings.homeAddress, ...dailyJobs.map(j => j.jobLocation || j.contactAddress), mapSettings.homeAddress];
        const jobInfo = [{ name: 'Home' }, ...dailyJobs.map(j => ({name: j.contactName, id: j.id})), { name: 'Home' }];
        const directionsService = new google.maps.DirectionsService();
        let importedCount = 0;

        for (let i = 0; i < addresses.length - 1; i++) {
            const startAddress = addresses[i];
            const endAddress = addresses[i+1];
            
            const existingLog = mileageLogs.find(log => log.date === date && log.startAddress === startAddress && log.endAddress === endAddress);
            if (existingLog) continue;
            
            try {
                const result = await directionsService.route({ origin: startAddress, destination: endAddress, travelMode: google.maps.TravelMode.DRIVING });
                if (result.routes[0] && result.routes[0].legs[0]) {
                    const leg = result.routes[0].legs[0];
                    const distanceMiles = leg.distance.value / 1609.34;
                    const nextStopInfo = jobInfo[i+1];
                    const newLog: Mileage = {
                        id: generateId(), date, startAddress, endAddress,
                        distance: parseFloat(distanceMiles.toFixed(2)),
                        notes: `Trip to ${nextStopInfo.name}${('id' in nextStopInfo) ? ` (Job #${nextStopInfo.id})` : ''}`,
                    };
                    await handleSaveMileageLog(newLog);
                    importedCount++;
                }
            } catch (error) {
                 if (showNotifications) addNotification(`Could not calculate leg ${i+1} of the route.`, 'error');
            }
        }
        
        if (showNotifications) addNotification(`Successfully imported ${importedCount} new trips.`, 'success');
        return importedCount;
    };

    const runAutomaticMileageLogging = React.useCallback(async () => {
        if (!contacts.length || !isMapsLoaded || !mapSettings.homeAddress) return;
        
        const processed = settings.processedMileageDates || [];
        const allRoutableDates = new Set<string>();
        const routableStatuses: JobStatus[] = ['Scheduled', 'Estimate Scheduled', 'In Progress'];

        contacts.forEach(c => c.jobTickets.forEach(t => (t.statusHistory || []).forEach(h => {
            if(routableStatuses.includes(h.status)) {
                allRoutableDates.add(h.timestamp.split('T')[0]);
            }
        })));
        
        const today = getLocalDateString(new Date());
        const datesToProcess = Array.from(allRoutableDates).filter(date => 
            !processed.includes(date) && date < today
        );

        if (datesToProcess.length > 0) {
            setIsGlobalLoading(true);
            setGlobalLoadingMessage(`Logging mileage for ${datesToProcess.length} past day(s)...`);
            let totalImported = 0;
            for (const date of datesToProcess) {
                totalImported += await importTripsForDate(date, false);
            }
            
            await saveSettings({ processedMileageDates: [...processed, ...datesToProcess] });
            setIsGlobalLoading(false);
            setGlobalLoadingMessage(null);
            if(totalImported > 0) addNotification(`Automatically logged ${totalImported} new trips from past jobs.`, 'success');
        }
    }, [contacts, isMapsLoaded, mapSettings.homeAddress, settings.processedMileageDates, addNotification, saveSettings]);

    useEffect(() => {
        if (contacts.length > 0 && isMapsLoaded && !hasRunInitialMileageCheck.current) {
            hasRunInitialMileageCheck.current = true;
            runAutomaticMileageLogging();
        }
    }, [contacts, isMapsLoaded, runAutomaticMileageLogging]);

    useEffect(() => {
        const checkAndRun = () => {
            const now = new Date();
            const lastCheck = new Date(settings.lastDailyMileageCheck || 0);
            
            if (now.getDate() !== lastCheck.getDate()) {
                console.log("Running daily mileage check...");
                runAutomaticMileageLogging();
                saveSettings({ lastDailyMileageCheck: now.toISOString() });
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAndRun();
            }
        };

        // Set up a daily check
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const msUntilTomorrow = tomorrow.getTime() - now.getTime();

        const timeoutId = setTimeout(() => {
            checkAndRun(); // Run once at midnight
            const intervalId = setInterval(checkAndRun, 24 * 60 * 60 * 1000); // Then every 24 hours
            return () => clearInterval(intervalId);
        }, msUntilTomorrow);
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

    }, [settings.lastDailyMileageCheck, runAutomaticMileageLogging, saveSettings]);

    const value: DataContextType = {
        contacts, expenses, bankTransactions, bankStatements, mileageLogs, categorizationRules, defaultFields, businessInfo, emailSettings, jobTemplates,
        partsCatalog, enabledStatuses, mapSettings, showContactPhotos, viewState, selectedContact,
        appStateForBackup, contactSelectorDate, user, isGuestMode, theme, isGlobalLoading, globalLoadingMessage,
        setViewState, setContactSelectorDate, handleSaveContact, handleDeleteContact, handleAddFilesToContact,
        handleUpdateContactJobTickets, handleTogglePinContact, handleSaveExpenses, handleDeleteExpense,
        handleImportBankStatement, handleSaveBankTransactions, handleDeleteBankStatement, handleDeleteAllBankData, 
        handleSaveMileageLog, handleDeleteMileageLog, importTripsForDate, handleAddSupplierTrip, handleSaveCategorizationRules,
        runManualReconciliation, saveSettings, loadDemoData, onSwitchToCloud, restoreBackup, setTheme,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};