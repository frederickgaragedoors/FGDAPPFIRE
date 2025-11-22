import { FileAttachment } from './types.ts';

const DB_NAME = 'BusinessContactsDB';
const DB_VERSION = 1;
const FILE_STORE_NAME = 'files';

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
            if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
                db.createObjectStore(FILE_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const initDB = getDB;

export const addFiles = async (files: FileAttachment[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);
    
    const promises = files.map(file => {
        return new Promise<void>((resolve, reject) => {
            const request = store.put(file);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });

    await Promise.all(promises);
};

export const getFiles = async (ids: string[]): Promise<FileAttachment[]> => {
    if (ids.length === 0) return [];
    const db = await getDB();
    const transaction = db.transaction(FILE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);
    
    const promises = ids.map(id => {
        return new Promise<FileAttachment | undefined>((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });

    const results = await Promise.all(promises);
    return results.filter((file): file is FileAttachment => !!file);
};

export const deleteFiles = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const db = await getDB();
    const transaction = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);
    
    const promises = ids.map(id => {
        return new Promise<void>((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });

    await Promise.all(promises);
};

export const getAllFiles = async (): Promise<FileAttachment[]> => {
    const db = await getDB();
    const transaction = db.transaction(FILE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const clearAndAddFiles = async (files: FileAttachment[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);

    return new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
            if (files && files.length > 0) {
                const addPromises = files.map(file => {
                    return new Promise<void>((resolveFile, rejectFile) => {
                        const addRequest = store.put(file);
                        addRequest.onsuccess = () => resolveFile();
                        addRequest.onerror = () => rejectFile(addRequest.error);
                    });
                });

                Promise.all(addPromises)
                    .then(() => resolve())
                    .catch(error => reject(error));
            } else {
                resolve();
            }
        };
    });
};
