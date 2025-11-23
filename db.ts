import { Contact } from './types.ts';

const DB_NAME = 'BusinessContactsDB';
const DB_VERSION = 2; // Bump version for new stores
const CONTACTS_STORE = 'contacts';
const SETTINGS_STORE = 'settings';

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
                // Use a known key for the single settings object
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
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
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveContacts = async (contacts: Contact[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(CONTACTS_STORE, 'readwrite');
    const store = transaction.objectStore(CONTACTS_STORE);
    // Clear first, then add all
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
        // 'singleton' is the fixed key for the settings object
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
