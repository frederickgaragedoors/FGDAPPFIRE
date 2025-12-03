import React, { useState, useEffect, useCallback } from 'react';
import { Supplier, Mileage, SavedRouteStop, RouteStop } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { ArrowLeftIcon, MapPinIcon, XIcon, PlusIcon } from './icons.tsx';
import { generateId } from '../utils.ts';

import { useRoutePlanner } from '../hooks/useRoutePlanner.ts';
import { useRouteMetrics } from '../hooks/useRouteMetrics.ts';
import RouteSidebar from './RouteSidebar.tsx';
import RouteMap from './RouteMap.tsx';

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
    if (previousStop?.type === 'job') {
        previousJobName = previousStop.data.contactName;
    }
    
    let nextStopName = 'your route';
    if (nextStop?.type === 'job') {
        nextStopName = `job for ${nextStop.data.contactName}`;
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
    // FIX: Get mapSettings, businessInfo, and route handlers from useApp context
    const { mapSettings, businessInfo, handleSaveRoute, handleClearRouteForDate } = useApp();
    const [selectedDate, setSelectedDate] = useState(initialDate || getLocalDateString(new Date()));
    const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
    const [addStopIndex, setAddStopIndex] = useState<number | null>(null);
    
    const routeStops = useRoutePlanner(selectedDate);
    const { routeMetrics, totalMetrics, leaveByTime } = useRouteMetrics(routeStops, selectedDate);

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
                previousStop.data.id.split('-')[0] === nextStop.data.id.split('-')[0]
            ) {
                newRoute.splice(stopIndex, 2);
            } else {
                newRoute.splice(stopIndex, 1);
            }
            
            const simplifiedRoute: SavedRouteStop[] = newRoute.map((stop): SavedRouteStop => {
                if (stop.type === 'home') return { type: 'home', label: stop.data.label };
                if (stop.type === 'job') return { type: 'job', jobId: stop.data.id.split('-')[0], contactId: stop.data.contactId };
                return { type: 'supplier', supplierId: stop.data.id, id: stop.id };
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
                const returnJobStop: RouteStop = { ...previousJob, id: `${previousJob.data.id.split('-')[0]}-${Date.now()}` };
                newStops.splice(addStopIndex, 0, supplierStop, returnJobStop);
            } else {
                 newStops.splice(addStopIndex, 0, supplierStop);
            }
        } else {
            newStops.splice(addStopIndex, 0, supplierStop);
        }
        
        const simplifiedRoute: SavedRouteStop[] = newStops.map((stop): SavedRouteStop => {
            if (stop.type === 'home') return { type: 'home', label: stop.data.label };
            if (stop.type === 'job') return { type: 'job', jobId: stop.data.id.split('-')[0], contactId: stop.data.contactId };
            return { type: 'supplier', supplierId: stop.data.id, id: stop.id };
        });
        handleSaveRoute(selectedDate, simplifiedRoute);
        setIsAddStopModalOpen(false);
    };

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
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            <RouteSidebar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onResetRoute={() => handleClearRouteForDate(selectedDate)}
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
            <RouteMap routeStops={routeStops} />
        </div>
      </div>
    );
};

export default RouteView;