import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Contact, Mileage, JobStatus } from '../types.ts';
import { generateId } from '../utils.ts';
import * as idb from '../db.ts';
import { useNotifications } from './NotificationContext.tsx';
import { useApp } from './AppContext.tsx';

declare const google: any;

interface MileageContextType {
    mileageLogs: Mileage[];
    handleSaveMileageLog: (log: Mileage) => Promise<void>;
    handleDeleteMileageLog: (logId: string) => Promise<void>;
    syncTripsForDate: (date: string, contacts: Contact[], showNotifications?: boolean) => Promise<void>;
    restoreMileageLogs: (logs: Mileage[]) => Promise<void>;
}

const MileageContext = createContext<MileageContextType | null>(null);
export const useMileage = () => { const context = useContext(MileageContext); if (!context) throw new Error('useMileage must be used within a MileageProvider'); return context; };

export const MileageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isGuestMode, mapSettings, businessInfo, routes, saveSettings, settings } = useApp();
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
            const collRef = collection(db, 'users', user.uid, 'mileageLogs');
            
            const existingDocs = await getDocs(collRef);
            existingDocs.forEach(d => batch.delete(d.ref));

            logs.forEach(item => batch.set(doc(collRef, item.id), item));
            await batch.commit();
        }
    };

    const handleSaveMileageLog = async (log: Mileage) => {
        const index = mileageLogs.findIndex(l => l.id === log.id);
        const updatedLogs = index > -1 ? mileageLogs.map((l, i) => i === index ? log : l) : [...mileageLogs, log];
        setMileageLogs(updatedLogs);
        
        if (isGuestMode) {
            await idb.saveMileageLogs(updatedLogs);
        } else if (user && db) {
            await setDoc(doc(db, 'users', user.uid, 'mileageLogs', log.id), log, { merge: true });
        }
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
    
    const syncTripsForDate = async (date: string, contacts: Contact[], showNotifications=true) => {
        const routableStatuses: JobStatus[] = ['Scheduled', 'Estimate Scheduled', 'In Progress', 'Supplier Run', 'Completed'];
        const jobsForDate = contacts.flatMap(c => 
            c.jobTickets.filter(t => {
                if (!t.jobLocation) return false;
                const latestEntry = t.statusHistory && t.statusHistory.length > 0 ? [...t.statusHistory].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
                if (latestEntry && routableStatuses.includes(latestEntry.status)) {
                    return latestEntry.timestamp.startsWith(date);
                }
                return false;
            }).map(t => ({...t, address: t.jobLocation!, contactId: c.id, contactName: c.name }))
        );

        type StopInfo = { address: string; simpleName: string; job?: {id: string; contactName: string} };
        let stopsForRoute: StopInfo[] = [];
        const savedRouteForDate = routes[date];

        if (savedRouteForDate) {
            savedRouteForDate.forEach(stop => {
                if (stop.type === 'home') {
                    stopsForRoute.push({ address: mapSettings.homeAddress, simpleName: 'Home' });
                } else if (stop.type === 'job') {
                    const jobData = contacts.flatMap(c => c.jobTickets.map(t => ({...t, contactName: c.name, address: t.jobLocation || c.address}))).find(j => j.id === stop.jobId.split('-')[0]);
                    if (jobData && jobData.address) {
                        stopsForRoute.push({ address: jobData.address, simpleName: jobData.contactName, job: {id: jobData.id, contactName: jobData.contactName} });
                    }
                } else if (stop.type === 'supplier') {
                    const supplierData = (businessInfo.suppliers || []).find(s => s.id === stop.supplierId);
                    if (supplierData) {
                        stopsForRoute.push({ address: supplierData.address, simpleName: supplierData.name });
                    }
                }
            });
        } else {
            if (jobsForDate.length > 0) {
                stopsForRoute.push({ address: mapSettings.homeAddress, simpleName: "Home" });
                jobsForDate.sort((a, b) => {
                    const findTime = (ticket: typeof a) => {
                        const relevantEntry = ticket.statusHistory?.find(h => h.timestamp.startsWith(date) && (h.status === 'Scheduled' || h.status === 'Estimate Scheduled'));
                        return relevantEntry ? relevantEntry.timestamp.split('T')[1] : undefined;
                    };
                    return (findTime(a) || "23:59").localeCompare(findTime(b) || "23:59");
                }).forEach(job => {
                    stopsForRoute.push({ address: job.address, simpleName: job.contactName, job: {id: job.id, contactName: job.contactName} });
                });
                stopsForRoute.push({ address: mapSettings.homeAddress, simpleName: "Home" });
            }
        }

        if (stopsForRoute.length < 2) {
            if (showNotifications) addNotification("No trips to import for this date.", "info");
            return;
        }

        const directionsService = new google.maps.DirectionsService();
        const idealTrips: Omit<Mileage, 'id' | 'createdAt'>[] = [];

        for (let i = 0; i < stopsForRoute.length - 1; i++) {
            const startStop = stopsForRoute[i];
            const endStop = stopsForRoute[i+1];
            if (startStop.address === endStop.address) continue;

            try {
                const result = await directionsService.route({ origin: startStop.address, destination: endStop.address, travelMode: google.maps.TravelMode.DRIVING });
                if (result.routes[0]?.legs[0]) {
                    const distanceMeters = result.routes[0].legs[0].distance.value;
                    idealTrips.push({
                        date,
                        startAddress: startStop.address,
                        endAddress: endStop.address,
                        distance: parseFloat((distanceMeters / 1609.34).toFixed(2)),
                        notes: `${startStop.simpleName} → ${endStop.simpleName}`,
                        ...(endStop.job && { jobId: endStop.job.id, jobContactName: endStop.job.contactName })
                    });
                }
            } catch (error) { console.error(`Directions request failed: ${startStop.address} to ${endStop.address}`, error); }
        }

        const existingLogsForDate = mileageLogs.filter(log => log.date === date);
        const autoSyncedLogs = existingLogsForDate.filter(log => log.source === 'route-planner' && !log.isManuallyEdited);

        const newLogs: Mileage[] = [];
        const logsToDeleteIds: string[] = [];
        let addedCount = 0;
        let removedCount = 0;

        for (const idealTrip of idealTrips) {
            const exists = existingLogsForDate.some(l => l.startAddress === idealTrip.startAddress && l.endAddress === idealTrip.endAddress);
            if (!exists) {
                newLogs.push({ ...idealTrip, id: generateId(), createdAt: new Date().toISOString(), source: 'route-planner' });
                addedCount++;
            }
        }

        for (const autoLog of autoSyncedLogs) {
            const stillExists = idealTrips.some(it => it.startAddress === autoLog.startAddress && it.endAddress === autoLog.endAddress);
            if (!stillExists) {
                logsToDeleteIds.push(autoLog.id);
                removedCount++;
            }
        }
        
        if (newLogs.length > 0 || logsToDeleteIds.length > 0) {
            const finalLogs = mileageLogs.filter(log => !logsToDeleteIds.includes(log.id)).concat(newLogs);
            setMileageLogs(finalLogs);
            await persistLogs(finalLogs);
        }

        const lastMileageSync = settings.lastMileageSync || {};
        await saveSettings({ lastMileageSync: { ...lastMileageSync, [date]: Date.now() } });

        if (showNotifications) {
            if (addedCount > 0 || removedCount > 0) {
                 addNotification(`Synced route: ${addedCount} trip(s) added, ${removedCount} removed.`, 'success');
            } else {
                 addNotification('Mileage is already up to date with your route plan.', 'info');
            }
        }
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
        syncTripsForDate,
        restoreMileageLogs,
    };

    return <MileageContext.Provider value={value}>{children}</MileageContext.Provider>;
};