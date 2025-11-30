import { Contact, Expense, BankTransaction, BankStatement, Mileage, CategorizationRule } from './types.ts';

const DB_NAME = 'BusinessContactsDB';
const DB_VERSION = 6; // Bump version for new stores
const CONTACTS_STORE = 'contacts';
const SETTINGS_STORE = 'settings';
const EXPENSES_STORE = 'expenses';
const BANK_TRANSACTIONS_STORE = 'bankTransactions';
const BANK_STATEMENTS_STORE = 'bankStatements';
const MILEAGE_LOGS_STORE = 'mileageLogs';
const CATEGORIZATION_RULES_STORE = 'categorizationRules';

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

// --- Contacts ---
export const getContacts = async (): Promise<Contact[]> => {
    const db = await getDB();
    const transaction = db.transaction(CONTACTS_STORE, 'readonly');
    const store = transaction.objectStore(CONTACTS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveContacts = async (contacts: Contact[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(CONTACTS_STORE, 'readwrite');
    const store = transaction.objectStore(CONTACTS_STORE);
    const clearRequest = store.clear();
    return new Promise((resolve, reject) => {
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            const addPromises = contacts.map(contact => {
                return new Promise<void>((res, rej) => {
                    const req = store.put(contact);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                });
            });
            Promise.all(addPromises).then(() => resolve()).catch(reject);
        };
    });
};

// --- Settings ---
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
export const getExpenses = async (): Promise<Expense[]> => {
    const db = await getDB();
    const transaction = db.transaction(EXPENSES_STORE, 'readonly');
    const store = transaction.objectStore(EXPENSES_STORE);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveExpenses = async (expenses: Expense[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(EXPENSES_STORE, 'readwrite');
    const store = transaction.objectStore(EXPENSES_STORE);
    const clearRequest = store.clear();
    return new Promise((resolve, reject) => {
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            const addPromises = expenses.map(expense => {
                return new Promise<void>((res, rej) => {
                    const req = store.put(expense);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                });
            });
            Promise.all(addPromises).then(() => resolve()).catch(reject);
        };
    });
};

// --- Bank Transactions ---
export const getBankTransactions = async (): Promise<BankTransaction[]> => {
    const db = await getDB();
    const transaction = db.transaction(BANK_TRANSACTIONS_STORE, 'readonly');
    const store = transaction.objectStore(BANK_TRANSACTIONS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveBankTransactions = async (transactions: BankTransaction[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(BANK_TRANSACTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(BANK_TRANSACTIONS_STORE);
    const clearRequest = store.clear();
    return new Promise((resolve, reject) => {
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            const addPromises = transactions.map(transaction => {
                return new Promise<void>((res, rej) => {
                    const req = store.put(transaction);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                });
            });
            Promise.all(addPromises).then(() => resolve()).catch(reject);
        };
    });
};

// --- Bank Statements ---
export const getBankStatements = async (): Promise<BankStatement[]> => {
    const db = await getDB();
    const transaction = db.transaction(BANK_STATEMENTS_STORE, 'readonly');
    const store = transaction.objectStore(BANK_STATEMENTS_STORE);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveBankStatements = async (statements: BankStatement[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(BANK_STATEMENTS_STORE, 'readwrite');
    const store = transaction.objectStore(BANK_STATEMENTS_STORE);
    const clearRequest = store.clear();
    return new Promise((resolve, reject) => {
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            const addPromises = statements.map(statement => {
                return new Promise<void>((res, rej) => {
                    const req = store.put(statement);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                });
            });
            Promise.all(addPromises).then(() => resolve()).catch(reject);
        };
    });
};

// Generic getter/setter for new stores to keep things DRY
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function saveAllToStore<T extends {id: string}>(storeName: string, data: T[]): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            const addPromises = data.map(item =>
                new Promise<void>((res, rej) => {
                    const req = store.put(item);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                })
            );
            Promise.all(addPromises).then(() => resolve()).catch(reject);
        };
    });
}

// --- Mileage Logs ---
export const getMileageLogs = (): Promise<Mileage[]> => getAllFromStore<Mileage>(MILEAGE_LOGS_STORE);
export const saveMileageLogs = (logs: Mileage[]): Promise<void> => saveAllToStore<Mileage>(MILEAGE_LOGS_STORE, logs);

// --- Categorization Rules ---
export const getCategorizationRules = (): Promise<CategorizationRule[]> => getAllFromStore<CategorizationRule>(CATEGORIZATION_RULES_STORE);
export const saveCategorizationRules = (rules: CategorizationRule[]): Promise<void> => saveAllToStore<CategorizationRule>(CATEGORIZATION_RULES_STORE, rules);
