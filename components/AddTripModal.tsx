import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mileage } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { XIcon } from './icons.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { generateId } from '../utils.ts';

declare const google: any;

interface AddTripModalProps {
    mileage: Mileage | null;
    onSave: (mileage: Mileage) => void;
    onClose: () => void;
}

const AddTripModal: React.FC<AddTripModalProps> = ({ mileage, onSave, onClose }) => {
    const { mapSettings } = useApp();
    const { addNotification } = useNotifications();
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(mapSettings.apiKey);

    const [currentLog, setCurrentLog] = useState<Mileage | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const startAddressRef = useRef<HTMLInputElement>(null);
    const endAddressRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (mileage) {
            setCurrentLog(mileage);
        }
    }, [mileage]);

    const handleChange = (field: keyof Mileage, value: any) => {
        if (!currentLog) return;
        setCurrentLog({ ...currentLog, [field]: value });
    };

    const setupAutocomplete = useCallback((inputRef: React.RefObject<HTMLInputElement>, field: 'startAddress' | 'endAddress') => {
        if (isMapsLoaded && inputRef.current) {
            const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
                fields: ['formatted_address'],
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                handleChange(field, place.formatted_address || '');
            });
        }
    }, [isMapsLoaded]);

    useEffect(() => {
        setupAutocomplete(startAddressRef, 'startAddress');
        setupAutocomplete(endAddressRef, 'endAddress');
    }, [setupAutocomplete]);

    const handleCalculateDistance = useCallback(async () => {
        if (!currentLog || !currentLog.startAddress || !currentLog.endAddress) {
            addNotification("Please enter both a start and end address.", 'error');
            return;
        }
        setIsCalculating(true);
        const directionsService = new google.maps.DirectionsService();
        try {
            const result = await directionsService.route({
                origin: currentLog.startAddress,
                destination: currentLog.endAddress,
                travelMode: google.maps.TravelMode.DRIVING,
            });
            if (result.routes[0] && result.routes[0].legs[0]) {
                const distanceMeters = result.routes[0].legs[0].distance.value;
                const distanceMiles = distanceMeters / 1609.34;
                handleChange('distance', parseFloat(distanceMiles.toFixed(2)));
            }
        } catch (error) {
            console.error("Directions request failed", error);
            addNotification("Could not calculate distance. Please check addresses.", 'error');
        } finally {
            setIsCalculating(false);
        }
    }, [currentLog, addNotification]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentLog) {
            onSave(currentLog);
        }
    };

    if (!currentLog) return null;

    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";
    
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
                    <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{mileage?.id ? 'Edit Trip' : 'Log New Trip'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-grow">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="date" className={labelStyles}>Date</label>
                                <input id="date" type="date" value={currentLog.date} onChange={e => handleChange('date', e.target.value)} className={inputStyles} required />
                            </div>
                            <div>
                                <label htmlFor="distance" className={labelStyles}>Distance (miles)</label>
                                <input id="distance" type="number" step="0.1" value={currentLog.distance} onChange={e => handleChange('distance', parseFloat(e.target.value) || 0)} className={inputStyles} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startAddress" className={labelStyles}>Start Address</label>
                                <input ref={startAddressRef} id="startAddress" type="text" value={currentLog.startAddress} onChange={e => handleChange('startAddress', e.target.value)} className={inputStyles} />
                            </div>
                            <div>
                                <label htmlFor="endAddress" className={labelStyles}>End Address</label>
                                <input ref={endAddressRef} id="endAddress" type="text" value={currentLog.endAddress} onChange={e => handleChange('endAddress', e.target.value)} className={inputStyles} />
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
                            <textarea id="notes" value={currentLog.notes || ''} onChange={e => handleChange('notes', e.target.value)} className={inputStyles} rows={2}></textarea>
                        </div>
                    </div>
                     <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2 rounded-b-lg border-t dark:border-slate-700 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">Save Trip</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTripModal;