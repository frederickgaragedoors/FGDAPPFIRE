import { Contact, Expense, BankTransaction, BankStatement, Mileage, CategorizationRule } from './types.ts';

const DB_NAME = 'BusinessContactsDB';
const DB_VERSION = 6; // Bump version for new stores
export const CONTACTS_STORE = 'contacts';
const SETTINGS_STORE = 'settings';
export const EXPENSES_STORE = 'expenses';
export const BANK_TRANSACTIONS_STORE = 'bankTransactions';
export const BANK_STATEMENTS_STORE = 'bankStatements';
export const MILEAGE_LOGS_STORE = 'mileageLogs';
export const CATEGORIZATION_RULES_STORE = 'categorizationRules';

let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening database');
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
                db.createObjectStore(CONTACTS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
                db.createObjectStore(EXPENSES_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(BANK_TRANSACTIONS_STORE)) {
                db.createObjectStore(BANK_TRANSACTIONS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(BANK_STATEMENTS_STORE)) {
                db.createObjectStore(BANK_STATEMENTS_STORE, { keyPath: 'id' });
            }
             if (!db.objectStoreNames.contains(MILEAGE_LOGS_STORE)) {
                db.createObjectStore(MILEAGE_LOGS_STORE, { keyPath: 'id' });
            }
             if (!db.objectStoreNames.contains(CATEGORIZATION_RULES_STORE)) {
                db.createObjectStore(CATEGORIZATION_RULES_STORE, { keyPath: 'id' });
            }
        };
    });
};

export const initDB = getDB;

// --- GENERIC DB OPERATIONS ---

export const putItem = async <T extends { id: string }>(storeName: string, item: T): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const putItems = async <T extends { id: string }>(storeName: string, items: T[]): Promise<void> => {
    if (items.length === 0) return Promise.resolve();
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const promises = items.map(item => new Promise<void>((res, rej) => {
            const req = store.put(item);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        }));
        Promise.all(promises).then(() => resolve()).catch(reject);
    });
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const deleteItems = async (storeName: string, ids: string[]): Promise<void> => {
    if (ids.length === 0) return Promise.resolve();
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const promises = ids.map(id => new Promise<void>((res, rej) => {
            const req = store.delete(id);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        }));
        Promise.all(promises).then(() => resolve()).catch(reject);
    });
};

export const clearStore = async (storeName: string): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};


export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

// --- Contacts ---
export const getContacts = (): Promise<Contact[]> => getAllFromStore<Contact>(CONTACTS_STORE);
export const getSettings = async (): Promise<any> => {
    const db = await getDB();
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.get('singleton');
        request.onsuccess = () => resolve(request.result?.data || {});
        request.onerror = () => reject(request.error);
    });
};

export const saveSettings = async (settings: any): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.put({ id: 'singleton', data: settings });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Expenses ---
export const getExpenses = (): Promise<Expense[]> => getAllFromStore<Expense>(EXPENSES_STORE);
export const getBankTransactions = (): Promise<BankTransaction[]> => getAllFromStore<BankTransaction>(BANK_TRANSACTIONS_STORE);
export const getBankStatements = (): Promise<BankStatement[]> => getAllFromStore<BankStatement>(BANK_STATEMENTS_STORE);
export const getMileageLogs = (): Promise<Mileage[]> => getAllFromStore<Mileage>(MILEAGE_LOGS_STORE);
export const getCategorizationRules = (): Promise<CategorizationRule[]> => getAllFromStore<CategorizationRule>(CATEGORIZATION_RULES_STORE);
