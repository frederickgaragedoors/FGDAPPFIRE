import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mileage } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { XIcon } from './icons.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { generateId } from '../utils.ts';

declare const google: any;

interface AddTripModalProps {
    isOpen: boolean;
    mileage: Mileage | null;
    onSave: (mileage: Mileage) => void;
    onClose: () => void;
}

const AddTripModal: React.FC<AddTripModalProps> = ({ isOpen, mileage, onSave, onClose }) => {
    const { mapSettings } = useApp();
    const { addNotification } = useNotifications();
    const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMaps(mapSettings.apiKey);

    const [date, setDate] = useState('');
    const [startAddress, setStartAddress] = useState('');
    const [endAddress, setEndAddress] = useState('');
    const [distance, setDistance] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [isCalculating, setIsCalculating] = useState(false);
    
    const dateInputRef = useRef<HTMLInputElement>(null);
    const startAddressRef = useRef<HTMLInputElement>(null);
    const endAddressRef = useRef<HTMLInputElement>(null);
    const startAutocompleteRef = useRef<any>(null);
    const endAutocompleteRef = useRef<any>(null);

    useEffect(() => {
        // This effect handles the setup and cleanup of the modal's state and side effects.
        if (!isOpen) {
            return; // Do nothing if the modal is closed.
        }
    
        // 1. Populate form state from props when the modal opens or `mileage` data changes.
        setDate(mileage?.date || new Date().toISOString().split('T')[0]);
        setStartAddress(mileage?.startAddress || mapSettings.homeAddress || '');
        setEndAddress(mileage?.endAddress || '');
        setDistance(mileage?.distance ?? '');
        setNotes(mileage?.notes || '');
    
        // 2. Initialize Google Maps Autocomplete if the API is loaded.
        if (isMapsLoaded && google && google.maps) {
            if (startAddressRef.current) {
                startAutocompleteRef.current = new google.maps.places.Autocomplete(startAddressRef.current);
                startAutocompleteRef.current.addListener('place_changed', () => {
                    const place = startAutocompleteRef.current.getPlace();
                    setStartAddress(place.formatted_address || place.name || '');
                });
            }
            if (endAddressRef.current) {
                endAutocompleteRef.current = new google.maps.places.Autocomplete(endAddressRef.current);
                endAutocompleteRef.current.addListener('place_changed', () => {
                    const place = endAutocompleteRef.current.getPlace();
                    setEndAddress(place.formatted_address || place.name || '');
                });
            }
        }
    
        // 3. Set focus on the date input for better UX.
        const timer = setTimeout(() => {
            dateInputRef.current?.focus();
        }, 150);
    
        // This cleanup function runs when the modal closes or dependencies change.
        return () => {
            clearTimeout(timer);
    
            // Properly remove Google Maps event listeners to prevent memory leaks.
            if (startAutocompleteRef.current) {
                google.maps.event.clearInstanceListeners(startAutocompleteRef.current);
                startAutocompleteRef.current = null;
            }
            if (endAutocompleteRef.current) {
                google.maps.event.clearInstanceListeners(endAutocompleteRef.current);
                endAutocompleteRef.current = null;
            }
        };
    }, [isOpen, isMapsLoaded, mileage, mapSettings.homeAddress]);


    const handleCalculateDistance = useCallback(async () => {
        if (!isMapsLoaded) {
            addNotification("Map service is not ready yet.", 'info');
            return;
        }
        if (!startAddress || !endAddress) {
            addNotification("Please enter both a start and end address.", 'error');
            return;
        }
        setIsCalculating(true);
        const directionsService = new google.maps.DirectionsService();
        try {
            const result = await directionsService.route({
                origin: startAddress,
                destination: endAddress,
                travelMode: google.maps.TravelMode.DRIVING,
            });
            if (result.routes[0] && result.routes[0].legs[0]) {
                const distanceMeters = result.routes[0].legs[0].distance.value;
                const distanceMiles = distanceMeters / 1609.34;
                setDistance(parseFloat(distanceMiles.toFixed(2)));
            }
        } catch (error) {
            console.error("Directions request failed", error);
            addNotification("Could not calculate distance. Please check addresses.", 'error');
        } finally {
            setIsCalculating(false);
        }
    }, [startAddress, endAddress, addNotification, isMapsLoaded]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = !!mileage;

        const finalLog: Mileage = {
            id: mileage?.id || generateId(),
            createdAt: mileage?.createdAt || new Date().toISOString(),
            date,
            startAddress,
            endAddress,
            distance: Number(distance),
            notes,
            jobId: mileage?.jobId,
            jobContactName: mileage?.jobContactName,
            source: isEditing ? mileage?.source : 'manual',
            isManuallyEdited: isEditing,
        };
        
        onSave(finalLog);
    };

    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";
    
    return (
         <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ${isOpen ? 'scale-100' : 'scale-95'}`}>
                <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
                    <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{mileage ? 'Edit Trip' : 'Log New Trip'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-grow">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="date" className={labelStyles}>Date</label>
                                <input ref={dateInputRef} id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyles} required />
                            </div>
                            <div>
                                <label htmlFor="distance" className={labelStyles}>Distance (miles)</label>
                                <input id="distance" type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputStyles} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startAddress" className={labelStyles}>Start Address</label>
                                <input ref={startAddressRef} id="startAddress" type="text" value={startAddress} onChange={e => setStartAddress(e.target.value)} className={inputStyles} autoComplete="off" />
                            </div>
                            <div>
                                <label htmlFor="endAddress" className={labelStyles}>End Address</label>
                                <input ref={endAddressRef} id="endAddress" type="text" value={endAddress} onChange={e => setEndAddress(e.target.value)} className={inputStyles} autoComplete="off" />
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
                            <textarea id="notes" value={notes || ''} onChange={e => setNotes(e.target.value)} className={inputStyles} rows={2}></textarea>
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