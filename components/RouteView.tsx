import React, { useState, useEffect } from 'react';
import { Supplier, SavedRouteStop, RouteStop, HomeStopData, JobStopData, RouteStopType } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { ArrowLeftIcon, MapPinIcon, XIcon, PlusIcon } from './icons.tsx';
import { generateId, getAppointmentDetailsForDate } from '../utils.ts';

import { useRoutePlanner } from '../hooks/useRoutePlanner.ts';
import { useRouteMetrics } from '../hooks/useRouteMetrics.ts';
import RouteSidebar from './RouteSidebar.tsx';
import RouteMap from './RouteMap.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

// --- TYPE DEFINITIONS ---
interface AddStopModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { supplierId: string, nextAction: 'return' | 'continue' }) => void;
    suppliers: Supplier[];
    previousStop?: RouteStop;
    nextStop?: RouteStop;
}

// --- MODAL COMPONENT ---
const AddStopModal: React.FC<AddStopModalProps> = ({ isOpen, onClose, onSave, suppliers, previousStop, nextStop }) => {
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [nextAction, setNextAction] = useState<'return' | 'continue' | null>('continue');

    useEffect(() => {
        if (isOpen) {
            setSelectedSupplierId(suppliers[0]?.id || '');
            setNextAction('continue');
        }
    }, [isOpen, suppliers]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSupplierId && nextAction) {
            onSave({ supplierId: selectedSupplierId, nextAction });
        }
    };

    const canReturn = previousStop?.type === 'job';
    
    let previousJobName = '';
    // FIX: Add type cast to resolve error when accessing property on a union type.
    if (previousStop?.type === 'job') {
        previousJobName = (previousStop.data as JobStopData).contactName;
    }
    
    let nextStopName = 'your route';
    // FIX: Add type cast to resolve error when accessing property on a union type.
    if (nextStop?.type === 'job') {
        nextStopName = `job for ${(nextStop.data as JobStopData).contactName}`;
    } else if (nextStop?.type === 'home') {
        nextStopName = 'Home';
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Stop to Route</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><XIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">1. Select Supplier</label>
                            {suppliers.length > 0 ? (
                                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md" required>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 p-3 bg-slate-100 dark:bg-slate-700 rounded-md">No suppliers found. Please add suppliers in Settings.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">2. Choose Next Action</label>
                            <div className="space-y-3">
                                <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${nextAction === 'continue' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input type="radio" name="nextAction" value="continue" checked={nextAction === 'continue'} onChange={() => setNextAction('continue')} className="mt-1 h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"/>
                                    <div className="ml-3 text-sm">
                                        <span className="font-medium text-slate-800 dark:text-slate-100">Continue to Next Stop</span>
                                        <p className="text-slate-500 dark:text-slate-400">Proceed to {nextStopName} after the supplier.</p>
                                    </div>
                                </label>
                                <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${!canReturn ? 'opacity-50 cursor-not-allowed' : ''} ${nextAction === 'return' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input type="radio" name="nextAction" value="return" checked={nextAction === 'return'} onChange={() => setNextAction('return')} disabled={!canReturn} className="mt-1 h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"/>
                                    <div className="ml-3 text-sm">
                                        <span className="font-medium text-slate-800 dark:text-slate-100">Return to Previous Job</span>
                                        <p className="text-slate-500 dark:text-slate-400">{canReturn ? `Go back to ${previousJobName} after the supplier.` : 'Cannot return from Home.'}</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300">Cancel</button>
                        <button type="submit" disabled={!selectedSupplierId || !nextAction} className="px-4 py-2 rounded-md text-sm text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300">Add to Route</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MAIN VIEW ---
interface RouteViewProps {
    onGoToSettings: () => void;
    onBack: () => void;
    onViewJobDetail: (contactId: string, ticketId: string) => void;
    initialDate?: string;
}

const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getLocalDateString(tomorrow);
};

const RouteView: React.FC<RouteViewProps> = ({ onGoToSettings, onBack, onViewJobDetail, initialDate }) => {
    const { mapSettings, businessInfo, handleSaveRoute, handleClearRouteForDate, routes } = useApp();
    const { contacts } = useContacts();
    const { addNotification } = useNotifications();
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(mapSettings.apiKey);
    const [selectedDate, setSelectedDate] = useState(initialDate || getLocalDateString(new Date()));
    const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
    const [addStopIndex, setAddStopIndex] = useState<number | null>(null);
    
    const routeStops = useRoutePlanner(selectedDate);
    const { routeMetrics, totalMetrics, leaveByTime } = useRouteMetrics(routeStops, selectedDate);
    
    useEffect(() => {
        // Automatically create a snapshot if one doesn't exist for the current view
        if (!routes[selectedDate] && routeStops.length > 1) {
             const simplifiedRoute: SavedRouteStop[] = routeStops.map((stop): SavedRouteStop => {
                if (stop.type === 'home') return { type: stop.type, label: (stop.data as HomeStopData).label };
                if (stop.type === 'job') return { type: stop.type, jobId: stop.id, contactId: (stop.data as JobStopData).contactId };
                return { type: stop.type, supplierId: (stop.data as Supplier).id, id: stop.id };
            });
            handleSaveRoute(selectedDate, simplifiedRoute);
        }
    }, [routeStops, selectedDate, routes, handleSaveRoute]);

    const handleResyncRoute = () => {
        const savedRoute = routes[selectedDate];
        if (!savedRoute || savedRoute.length <= 2) {
            handleClearRouteForDate(selectedDate);
            addNotification("Route reset to today's jobs.", "info");
            return;
        }

        const freshJobsForDate = contacts.flatMap(contact =>
            (contact.jobTickets || []).flatMap(ticket => {
                const appointmentDetails = getAppointmentDetailsForDate(ticket, selectedDate);
                if (appointmentDetails) {
                    return [{ id: ticket.id, time: appointmentDetails.time, contactId: contact.id }];
                }
                return [];
            })
        ).sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));
        
        const freshJobIds = new Set(freshJobsForDate.map(j => j.id));

        let newRoute: SavedRouteStop[] = [
            { type: 'home', label: 'Start' },
            ...freshJobsForDate.map(job => ({ type: 'job' as RouteStopType, jobId: job.id, contactId: job.contactId })),
            { type: 'home', label: 'End' }
        ];

        const manualSegments: { anchorId: string | null; segment: SavedRouteStop[] }[] = [];
        for (let i = 0; i < savedRoute.length; i++) {
            const currentStop = savedRoute[i];
            if (currentStop.type === 'supplier') {
                const anchorStop = savedRoute[i - 1];
                if (!anchorStop) continue;

                let anchorId: string | null = null;
                if (anchorStop.type === 'job' && anchorStop.jobId) {
                    anchorId = anchorStop.jobId;
                } else if (anchorStop.type === 'home' && anchorStop.label === 'Start') {
                    anchorId = 'start_home';
                }

                if (anchorId !== null) {
                    const segment: SavedRouteStop[] = [currentStop];
                    const nextStop = savedRoute[i + 1];
                    if (anchorStop.type === 'job' && nextStop && nextStop.type === 'job' && nextStop.jobId === anchorStop.jobId) {
                        segment.push(nextStop);
                        i++;
                    }
                    manualSegments.push({ anchorId, segment });
                }
            }
        }

        for (const { anchorId, segment } of manualSegments.reverse()) {
            let anchorIndex = -1;
            if (anchorId === 'start_home') {
                anchorIndex = 0;
            } else if (anchorId) {
                for (let i = newRoute.length - 1; i >= 0; i--) {
                    if (newRoute[i].jobId === anchorId) {
                        anchorIndex = i;
                        break;
                    }
                }
            }

            if (anchorIndex !== -1) {
                newRoute.splice(anchorIndex + 1, 0, ...segment);
            } else {
                const oldAnchorIndex = savedRoute.findIndex(s => s.jobId === anchorId);
                let fallbackAnchorId: string | null = null;
                for (let i = oldAnchorIndex - 1; i >= 0; i--) {
                    const potentialAnchor = savedRoute[i];
                    if (potentialAnchor.type === 'job' && potentialAnchor.jobId && freshJobIds.has(potentialAnchor.jobId)) {
                        fallbackAnchorId = potentialAnchor.jobId;
                        break;
                    }
                }
                
                let fallbackIndex = -1;
                if (fallbackAnchorId) {
                     for (let i = newRoute.length - 1; i >= 0; i--) {
                        if (newRoute[i].jobId === fallbackAnchorId) {
                            fallbackIndex = i;
                            break;
                        }
                    }
                }

                if (fallbackIndex !== -1) {
                    newRoute.splice(fallbackIndex + 1, 0, ...segment);
                } else {
                    newRoute.splice(1, 0, ...segment);
                }
            }
        }

        handleSaveRoute(selectedDate, newRoute);
        addNotification("Route re-synced with latest jobs.", "success");
    };

    const handleDeleteStop = (id: string) => {
        const stopIndex = routeStops.findIndex(stop => stop.id === id);
        if (stopIndex === -1) return;
    
        const stopToDelete = routeStops[stopIndex];
        let newRoute = [...routeStops];
    
        if (stopToDelete.type === 'supplier') {
            const previousStop = stopIndex > 0 ? newRoute[stopIndex - 1] : null;
            const nextStop = stopIndex < newRoute.length - 1 ? newRoute[stopIndex + 1] : null;
    
            if (
                previousStop?.type === 'job' &&
                nextStop?.type === 'job' &&
                (previousStop.data as JobStopData).id.split('-')[0] === (nextStop.data as JobStopData).id.split('-')[0]
            ) {
                newRoute.splice(stopIndex, 2);
            } else {
                newRoute.splice(stopIndex, 1);
            }
            
            const simplifiedRoute: SavedRouteStop[] = newRoute.map((stop): SavedRouteStop => {
                if (stop.type === 'home') return { type: stop.type, label: (stop.data as HomeStopData).label };
                if (stop.type === 'job') return { type: stop.type, jobId: (stop.data as JobStopData).id.split('-')[0], contactId: (stop.data as JobStopData).contactId };
                return { type: stop.type, supplierId: (stop.data as Supplier).id, id: stop.id };
            });
            handleSaveRoute(selectedDate, simplifiedRoute);
        }
    };

    const handleAddSupplierStop = ({ supplierId, nextAction }: { supplierId: string, nextAction: 'return' | 'continue' }) => {
        if (addStopIndex === null) return;
        
        const supplier = (businessInfo.suppliers || []).find(s => s.id === supplierId);
        if (!supplier) return;

        const newStops = [...routeStops];
        const supplierStop: RouteStop = { type: 'supplier', id: `supplier-${generateId()}`, data: supplier };

        if (nextAction === 'return') {
            const previousJob = routeStops[addStopIndex - 1];
            if (previousJob && previousJob.type === 'job') {
                const returnJobStop: RouteStop = { ...previousJob, id: `${(previousJob.data as JobStopData).id.split('-')[0]}-${Date.now()}` };
                newStops.splice(addStopIndex, 0, supplierStop, returnJobStop);
            } else {
                 newStops.splice(addStopIndex, 0, supplierStop);
            }
        } else {
            newStops.splice(addStopIndex, 0, supplierStop);
        }
        
        const simplifiedRoute: SavedRouteStop[] = newStops.map((stop): SavedRouteStop => {
            if (stop.type === 'home') return { type: stop.type, label: (stop.data as HomeStopData).label };
            if (stop.type === 'job') return { type: stop.type, jobId: stop.id, contactId: (stop.data as JobStopData).contactId };
            return { type: stop.type, supplierId: (stop.data as Supplier).id, id: stop.id };
        });
        handleSaveRoute(selectedDate, simplifiedRoute);
        setIsAddStopModalOpen(false);
    };

    if (mapsError) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-100 dark:bg-slate-900">
                <MapPinIcon className="w-12 h-12 text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Map Service Error</h2>
                <p className="mt-2 max-w-sm text-slate-500 dark:text-slate-400">
                    Could not connect to Google Maps. The API Key may be invalid or missing required permissions.
                </p>
                <p className="mt-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-md max-w-sm">
                    {mapsError.message}
                </p>
                <button onClick={onGoToSettings} className="mt-6 px-4 py-2 bg-sky-500 text-white font-medium rounded-md hover:bg-sky-600">Go to Settings</button>
            </div>
        );
    }

    if (!mapSettings.apiKey || !mapSettings.homeAddress) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-100 dark:bg-slate-900">
                <MapPinIcon className="w-12 h-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Map Settings Required</h2>
                <p className="mt-2 max-w-sm text-slate-500 dark:text-slate-400">Please provide a Google Maps API Key and your Home/Base Address in the settings to use the routing features.</p>
                <button onClick={onGoToSettings} className="mt-6 px-4 py-2 bg-sky-500 text-white font-medium rounded-md hover:bg-sky-600">Go to Settings</button>
            </div>
        );
    }
    
    return (
      <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
        <AddStopModal 
            isOpen={isAddStopModalOpen}
            onClose={() => setIsAddStopModalOpen(false)}
            onSave={handleAddSupplierStop}
            suppliers={businessInfo.suppliers || []}
            previousStop={addStopIndex ? routeStops[addStopIndex - 1] : undefined}
            nextStop={addStopIndex ? routeStops[addStopIndex] : undefined}
        />
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 mr-2"><ArrowLeftIcon className="w-6 h-6" /></button>
                <div>
                    <h1 className="text-2xl font-bold">Daily Route</h1>
                    <p className="text-slate-500">Plan and optimize your jobs for the day.</p>
                </div>
            </div>
        </div>
        <div className="flex-grow flex flex-col md:flex-row md:overflow-hidden">
            <RouteSidebar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onResyncRoute={handleResyncRoute}
                getToday={() => getLocalDateString(new Date())}
                getTomorrow={getTomorrowDateString}
                routeStops={routeStops}
                routeMetrics={routeMetrics}
                totalMetrics={totalMetrics}
                leaveByTime={leaveByTime}
                onAddStop={(index) => { setAddStopIndex(index); setIsAddStopModalOpen(true); }}
                onDeleteStop={handleDeleteStop}
                onViewJobDetail={onViewJobDetail}
            />
            <div className="order-2 md:order-none h-96 md:h-auto md:w-2/3 lg:w-3/4">
                {isMapsLoaded ? (
                    <RouteMap routeStops={routeStops} />
                ) : (
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <div className="text-slate-500">Loading Map...</div>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
};

export default RouteView;
