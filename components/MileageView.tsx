import React, { useState, useMemo, useEffect } from 'react';
import { useMileage } from '../contexts/MileageContext.tsx';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { Mileage } from '../types.ts';
import { CarIcon, PlusIcon, TrashIcon, EditIcon, RefreshIcon, LinkIcon, PencilSquareIcon } from './icons.tsx';
import { generateId, getLocalDateString, getAppointmentDetailsForDate } from '../utils.ts';
import EmptyState from './EmptyState.tsx';
import AddTripModal from './AddTripModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

const MileageView: React.FC = () => {
    const { mileageLogs, handleSaveMileageLog, handleDeleteMileageLog, syncTripsForDate } = useMileage();
    const { contacts } = useContacts();
    const { mapSettings, businessInfo, settings } = useApp();
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(mapSettings.apiKey);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMileage, setEditingMileage] = useState<Mileage | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
    const [logToDelete, setLogToDelete] = useState<Mileage | null>(null);

    const legColors = [
      'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 
      'bg-indigo-500', 'bg-pink-500', 'bg-teal-500',
      'bg-purple-500', 'bg-lime-500'
    ];
    
    // Auto-sync logic
    useEffect(() => {
        const todayStr = getLocalDateString(new Date());
        if (selectedDate !== todayStr) return; // Only auto-sync for today's view

        const autoSyncForToday = async () => {
             const lastSyncForToday = (settings.lastMileageSync || {})[todayStr];
             if (lastSyncForToday) {
                const lastSyncDate = new Date(lastSyncForToday);
                const today = new Date();
                // Check if last sync was on the same calendar day as today
                 if (lastSyncDate.getFullYear() === today.getFullYear() &&
                    lastSyncDate.getMonth() === today.getMonth() &&
                    lastSyncDate.getDate() === today.getDate()) {
                    return; // Already synced today.
                }
             }

             setIsCalculating(true);
             await syncTripsForDate(todayStr, contacts, true);
             setIsCalculating(false);
        };

        if(isMapsLoaded) {
            autoSyncForToday();
        }

    }, [isMapsLoaded, contacts, selectedDate, settings.lastMileageSync]);


    const handleSyncTrips = async () => {
        setIsCalculating(true);
        await syncTripsForDate(selectedDate, contacts, true);
        setIsCalculating(false);
    };

    const handleNewEntry = () => {
        setEditingMileage(null); // Clear any previous editing state
        setIsModalOpen(true);
    };

    const handleEdit = (log: Mileage) => {
        setEditingMileage(log);
        setIsModalOpen(true);
    };

    const handleSave = (log: Mileage) => {
        handleSaveMileageLog(log);
        setIsModalOpen(false);
        setEditingMileage(null);
    };

    const performDelete = () => {
        if (logToDelete) {
            handleDeleteMileageLog(logToDelete.id);
            setLogToDelete(null);
        }
    };

    const logsByDate = useMemo(() => {
        const groups: { [date: string]: Mileage[] } = {};
        mileageLogs.forEach(log => {
            if (!groups[log.date]) {
                groups[log.date] = [];
            }
            groups[log.date].push(log);
        });

        // For each group, sort trips chronologically based on job appointment time or creation time.
        for (const date in groups) {
            groups[date].sort((a, b) => {
                const getSortTime = (log: Mileage): string => {
                    if (log.jobId) {
                        for (const contact of contacts) {
                            const ticket = (contact.jobTickets || []).find(t => t.id === log.jobId);
                            if (ticket) {
                                const appointmentDetails = getAppointmentDetailsForDate(ticket, log.date);
                                if (appointmentDetails?.time) {
                                    return appointmentDetails.time; // "HH:MM" format
                                }
                                break;
                            }
                        }
                    }
                    // Fallback for non-job trips (to home, supplier) or manual trips without a job link.
                    // Use the time part of createdAt as the best available proxy for trip order.
                    return new Date(log.createdAt || 0).toTimeString().slice(0, 8); // "HH:MM:SS" format
                };

                const timeA = getSortTime(a);
                const timeB = getSortTime(b);

                // Primary sort by inferred trip time
                if (timeA.localeCompare(timeB) !== 0) {
                    return timeA.localeCompare(timeB);
                }

                // Secondary sort by creation time as a stable fallback for trips with same inferred time
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            });
        }

        // Sort dates descending to show most recent days first
        const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        return sortedDates.map(date => ({ date, logs: groups[date] }));
    }, [mileageLogs, contacts]);

    const summary = useMemo(() => {
        const totalDistance = mileageLogs.reduce((sum, log) => sum + log.distance, 0);
        const totalDeduction = totalDistance * (businessInfo.standardMileageRate || 0);
        return { totalDistance, totalDeduction, totalTrips: mileageLogs.length };
    }, [mileageLogs, businessInfo.standardMileageRate]);

    return (
        <>
            <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mileage Tracker</h1>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Log business-related trips for expense reporting.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-2">
                            <div className="flex items-center gap-2 order-1 sm:order-2">
                                <button onClick={handleSyncTrips} disabled={isCalculating || !isMapsLoaded} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                                    <RefreshIcon className={`w-5 h-5 ${isCalculating ? 'animate-spin' : ''}`} />
                                    <span className="sm:hidden">{isCalculating ? 'Syncing...' : 'Sync'}</span>
                                    <span className="hidden sm:inline">{isCalculating ? 'Syncing...' : 'Sync with Route'}</span>
                                </button>
                                <button onClick={handleNewEntry} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                    <PlusIcon className="w-5 h-5" />
                                    <span className="sm:hidden">Log Trip</span>
                                    <span className="hidden sm:inline">Log New Trip</span>
                                </button>
                            </div>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)} 
                                className="order-2 sm:order-1 w-full sm:w-auto border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" 
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 flex-grow space-y-6">
                    {mapsError && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                            <p className="font-bold mb-1">Map Service Error</p>
                            <p>Could not connect to Google Maps. Trip syncing is disabled. Please check your API Key in Settings.</p>
                            <p className="text-xs opacity-70 mt-2">{mapsError.message}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Trips</h3>
                            <p className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summary.totalTrips}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Distance</h3>
                            <p className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summary.totalDistance.toFixed(1)} mi</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Deduction</h3>
                            <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-500">${summary.totalDeduction.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 p-6">Logged Trips</h2>
                        {mileageLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Trip</th>
                                            <th className="px-6 py-3">Details</th>
                                            <th className="px-6 py-3 text-right">Distance</th>
                                            <th className="px-6 py-3 text-right">Deduction</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                            <th className="px-6 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logsByDate.map((group, groupIndex) => {
                                            const groupColorClass = groupIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50';
                                            return group.logs.map((log, logIndex) => {
                                                const legLabel = String.fromCharCode(65 + logIndex);
                                                const legColor = legColors[logIndex % legColors.length];
                                                return (
                                                    <tr key={log.id} className={`${groupColorClass} border-t border-slate-100 dark:border-slate-700`}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white ${legColor}`}>
                                                                    {legLabel}
                                                                </span>
                                                                <div>
                                                                    <div className="text-sm text-slate-600 dark:text-slate-300">{new Date(log.date + 'T00:00:00').toLocaleDateString()}</div>
                                                                    {log.jobContactName && <div className="text-xs text-slate-500 dark:text-slate-400">Job: {log.jobContactName}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-100 max-w-xs">
                                                            <div className="font-semibold">{log.notes || 'Business Trip'}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{log.startAddress} &rarr; {log.endAddress}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100 text-right">{log.distance.toFixed(1)} mi</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-500 font-semibold text-right">
                                                            ${(log.distance * (businessInfo.standardMileageRate || 0)).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                          <div className="flex justify-center items-center gap-2">
                                                            {log.source === 'route-planner' && !log.isManuallyEdited && (
                                                                <LinkIcon className="w-5 h-5 text-slate-400" title="Synced from Route Planner" />
                                                            )}
                                                            {log.isManuallyEdited && (
                                                                <PencilSquareIcon className="w-5 h-5 text-amber-500" title="Manually Edited" />
                                                            )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                            <button onClick={() => handleEdit(log)} className="p-2 text-slate-500 hover:text-sky-600"><EditIcon className="w-5 h-5"/></button>
                                                            <button onClick={() => setLogToDelete(log)} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8">
                                <EmptyState 
                                    Icon={CarIcon} 
                                    title="No Trips Logged" 
                                    message="Click 'Log New Trip' or 'Sync with Route' to get started."
                                    actionText="Log New Trip"
                                    onAction={handleNewEntry}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <AddTripModal 
                isOpen={isModalOpen}
                mileage={editingMileage}
                onSave={handleSave}
                onClose={() => { setIsModalOpen(false); setEditingMileage(null); }}
            />
            {logToDelete && (
                <ConfirmationModal 
                    isOpen={!!logToDelete}
                    onClose={() => setLogToDelete(null)}
                    onConfirm={performDelete}
                    title="Delete Trip"
                    message={`Are you sure you want to delete this trip? This action cannot be undone.`}
                />
            )}
        </>
    );
};

export default MileageView;
