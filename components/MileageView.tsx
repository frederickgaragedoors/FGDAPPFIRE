import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../contexts/DataContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { Mileage } from '../types.ts';
import { CarIcon, PlusIcon, TrashIcon, EditIcon } from './icons.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { generateId, getLocalDateString } from '../utils.ts';
import EmptyState from './EmptyState.tsx';

declare const google: any;

const MileageView: React.FC = () => {
    const { mileageLogs, handleSaveMileageLog, handleDeleteMileageLog, mapSettings, businessInfo, importTripsForDate } = useData();
    const { addNotification } = useNotifications();
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(mapSettings.apiKey);

    const [editingMileage, setEditingMileage] = useState<Mileage | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));

    const startAddressRef = useRef<HTMLInputElement>(null);
    const endAddressRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const setupAutocomplete = useCallback((inputRef: React.RefObject<HTMLInputElement>, onPlaceChanged: (place: any) => void) => {
        if (isMapsLoaded && inputRef.current) {
            const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
                fields: ['formatted_address'],
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                onPlaceChanged(place);
            });
        }
    }, [isMapsLoaded]);

    useEffect(() => {
        setupAutocomplete(startAddressRef, (place) => {
            if(editingMileage) setEditingMileage(prev => ({...prev!, startAddress: place.formatted_address || ''}));
        });
        setupAutocomplete(endAddressRef, (place) => {
             if(editingMileage) setEditingMileage(prev => ({...prev!, endAddress: place.formatted_address || ''}));
        });
    }, [setupAutocomplete, editingMileage]);

    const handleCalculateDistance = useCallback(async () => {
        if (!editingMileage || !editingMileage.startAddress || !editingMileage.endAddress) {
            addNotification("Please enter both a start and end address.", 'error');
            return;
        }
        setIsCalculating(true);
        const directionsService = new google.maps.DirectionsService();
        try {
            const result = await directionsService.route({
                origin: editingMileage.startAddress,
                destination: editingMileage.endAddress,
                travelMode: google.maps.TravelMode.DRIVING,
            });
            if (result.routes[0] && result.routes[0].legs[0]) {
                const distanceMeters = result.routes[0].legs[0].distance.value;
                const distanceMiles = distanceMeters / 1609.34;
                setEditingMileage(prev => ({ ...prev!, distance: parseFloat(distanceMiles.toFixed(2)) }));
            }
        } catch (error) {
            console.error("Directions request failed", error);
            addNotification("Could not calculate distance. Please check addresses.", 'error');
        } finally {
            setIsCalculating(false);
        }
    }, [editingMileage, addNotification]);

    const handleImportTrips = async () => {
        setIsCalculating(true);
        await importTripsForDate(selectedDate);
        setIsCalculating(false);
    };

    const handleNewEntry = () => {
        setEditingMileage({
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            startAddress: mapSettings.homeAddress || '',
            endAddress: '',
            distance: 0,
            notes: '',
        });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMileage) return;

        handleSaveMileageLog(editingMileage);
        setEditingMileage(null);
    };

    const handleDelete = (id: string) => {
        if(window.confirm("Are you sure you want to delete this trip?")) {
            handleDeleteMileageLog(id);
        }
    };

    const sortedLogs = useMemo(() => {
        return [...mileageLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [mileageLogs]);

    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";
    
    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mileage Tracker</h1>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">Log business-related trips for expense reporting.</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                        <button onClick={handleImportTrips} disabled={isCalculating} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                            {isCalculating ? 'Importing...' : 'Import Trips'}
                        </button>
                        <button onClick={handleNewEntry} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                            <PlusIcon className="w-5 h-5" /> Log New Trip
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 flex-grow space-y-6">
                {editingMileage && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Log a Trip</h2>
                        <form ref={formRef} onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="date" className={labelStyles}>Date</label>
                                    <input id="date" type="date" value={editingMileage.date} onChange={e => setEditingMileage({...editingMileage, date: e.target.value})} className={inputStyles} required />
                                </div>
                                <div>
                                    <label htmlFor="distance" className={labelStyles}>Distance (miles)</label>
                                    <input id="distance" type="number" step="0.1" value={editingMileage.distance} onChange={e => setEditingMileage({...editingMileage, distance: parseFloat(e.target.value) || 0})} className={inputStyles} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startAddress" className={labelStyles}>Start Address</label>
                                    <input ref={startAddressRef} id="startAddress" type="text" value={editingMileage.startAddress} onChange={e => setEditingMileage({...editingMileage, startAddress: e.target.value})} className={inputStyles} />
                                </div>
                                <div>
                                    <label htmlFor="endAddress" className={labelStyles}>End Address</label>
                                    <input ref={endAddressRef} id="endAddress" type="text" value={editingMileage.endAddress} onChange={e => setEditingMileage({...editingMileage, endAddress: e.target.value})} className={inputStyles} />
                                </div>
                            </div>
                            <div>
                                <button type="button" onClick={handleCalculateDistance} disabled={isCalculating || !isMapsLoaded} className="text-sm font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isCalculating ? 'Calculating...' : 'Calculate Distance'}
                                </button>
                                {mapsError && <p className="text-xs text-red-500 mt-1">{mapsError.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="notes" className={labelStyles}>Notes / Purpose</label>
                                <textarea id="notes" value={editingMileage.notes || ''} onChange={e => setEditingMileage({...editingMileage, notes: e.target.value})} className={inputStyles} rows={2}></textarea>
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setEditingMileage(null)} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">Save Trip</button>
                            </div>
                        </form>
                    </div>
                )}
                
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 p-6">Logged Trips</h2>
                     {sortedLogs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Trip</th>
                                        <th className="px-6 py-3">Distance</th>
                                        <th className="px-6 py-3">Expense</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {sortedLogs.map(log => (
                                        <tr key={log.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{new Date(log.date + 'T00:00:00').toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-100 max-w-xs truncate">
                                                <span className="font-semibold">{log.notes || 'Business Trip'}</span>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{log.startAddress} &rarr; {log.endAddress}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">{log.distance} mi</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-500 font-semibold">
                                                ${(log.distance * (businessInfo.standardMileageRate || 0)).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                <button onClick={() => setEditingMileage(log)} className="p-2 text-slate-500 hover:text-sky-600"><EditIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDelete(log.id)} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     ) : (
                        <div className="p-8">
                            <EmptyState Icon={CarIcon} title="No Trips Logged" message="Click 'Log New Trip' to get started." />
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default MileageView;