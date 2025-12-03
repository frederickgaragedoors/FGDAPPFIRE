import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Contact, Mileage } from '../types.ts';
import { generateId } from '../utils.ts';
import * as idb from '../db.ts';
import { useNotifications } from './NotificationContext.tsx';
import { useApp } from './AppContext.tsx';

interface MileageContextType {
    mileageLogs: Mileage[];
    handleSaveMileageLog: (log: Mileage) => Promise<void>;
    handleDeleteMileageLog: (logId: string) => Promise<void>;
    importTripsForDate: (date: string, contacts: Contact[], showNotifications?: boolean) => Promise<number>;
    restoreMileageLogs: (logs: Mileage[]) => Promise<void>;
}

const MileageContext = createContext<MileageContextType | null>(null);
export const useMileage = () => { const context = useContext(MileageContext); if (!context) throw new Error('useMileage must be used within a MileageProvider'); return context; };

export const MileageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isGuestMode, mapSettings } = useApp();
    const { addNotification } = useNotifications();
    
    const [mileageLogs, setMileageLogs] = useState<Mileage[]>([]);
    
    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const sMileage = await idb.getMileageLogs();
                setMileageLogs(sMileage || []);
            } else { 
                setMileageLogs([]);
            }
        };
        loadInitialData();
    }, [isGuestMode]);
    
    useEffect(() => {
        if (isGuestMode || !user || !db) return;
        const unsubMileage = onSnapshot(collection(db, 'users', user.uid, 'mileageLogs'), (snap) => setMileageLogs(snap.docs.map(d => d.data() as Mileage)));
        return () => { unsubMileage(); };
    }, [user, isGuestMode]);

    const persistLogs = async (logs: Mileage[]) => {
        if (isGuestMode) {
            await idb.saveMileageLogs(logs);
        } else if (user && db) {
            const batch = writeBatch(db);
            logs.forEach(item => batch.set(doc(db, 'users', user.uid, 'mileageLogs', item.id), item, { merge: true }));
            await batch.commit();
        }
    };

    const handleSaveMileageLog = async (log: Mileage) => {
        const index = mileageLogs.findIndex(l => l.id === log.id);
        const updatedLogs = index > -1 ? mileageLogs.map((l, i) => i === index ? log : l) : [...mileageLogs, log];
        setMileageLogs(updatedLogs);
        await persistLogs(updatedLogs);
    };

    const handleDeleteMileageLog = async (logId: string) => {
        const updatedLogs = mileageLogs.filter(l => l.id !== logId);
        setMileageLogs(updatedLogs);
        if (isGuestMode) {
            await idb.saveMileageLogs(updatedLogs);
        } else if (user && db) {
            await deleteDoc(doc(db, 'users', user.uid, 'mileageLogs', logId));
        }
    };
    
    const importTripsForDate = async (date: string, contacts: Contact[], showNotifications=true): Promise<number> => {
        // FIX: Updated the `importTripsForDate` function to correctly identify jobs for a specific date by querying the `statusHistory` array instead of the deprecated `date` property. This change ensures that mileage logs are generated based on the most accurate and current job scheduling data, aligning with the application's refactored data model.
        const jobsForDate = contacts.flatMap(c => 
            c.jobTickets.filter(t => {
                if (!t.jobLocation) return false;
                const latestEntry = t.statusHistory && t.statusHistory.length > 0 ? [...t.statusHistory].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
                if (latestEntry) {
                    return latestEntry.timestamp.startsWith(date);
                }
                return t.createdAt?.startsWith(date);
            })
        ).map(t => ({...t, address: t.jobLocation!}));
        if (jobsForDate.length === 0) { if(showNotifications) addNotification("No jobs with locations found for this date.", "info"); return 0; }
        const waypoints = [mapSettings.homeAddress, ...jobsForDate.map(j => j.address), mapSettings.homeAddress];
        let importedCount = 0;
        
        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i]; const end = waypoints[i+1];
            if (start === end) continue; // Skip trips with same start/end
            const existing = mileageLogs.find(l => l.date === date && l.startAddress === start && l.endAddress === end);
            if (existing) continue;

            const newLog: Mileage = { id: generateId(), date, startAddress: start, endAddress: end, distance: 0, notes: `Trip for job(s)` };
            await handleSaveMileageLog(newLog);
            importedCount++;
        }
        if(showNotifications) addNotification(`Imported ${importedCount} potential trip(s). Please calculate distances manually.`, 'success');
        return importedCount;
    };
    
    const restoreMileageLogs = async (logs: Mileage[]) => {
        setMileageLogs(logs);
         if (isGuestMode) {
            await idb.saveMileageLogs(logs);
        } else if (user && db) {
            const collRef = collection(db, 'users', user.uid, 'mileageLogs');
            const snapshot = await getDocs(collRef);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            logs.forEach(item => batch.set(doc(db, 'users', user.uid, 'mileageLogs', item.id), item));
            await batch.commit();
        }
    };

    const value: MileageContextType = {
        mileageLogs,
        handleSaveMileageLog,
        handleDeleteMileageLog,
        importTripsForDate,
        restoreMileageLogs,
    };

    return <MileageContext.Provider value={value}>{children}</MileageContext.Provider>;
};