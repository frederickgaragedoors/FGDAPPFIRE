import React, { useState, useEffect, useRef } from 'react';
import { Supplier, SavedRouteStop, RouteStop, HomeStopData, JobStopData, RouteStopType, PlaceStopData } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { ArrowLeftIcon, MapPinIcon, XIcon, PlusIcon, SearchIcon, BuildingStorefrontIcon, MapIcon } from './icons.tsx';
import { generateId, getAppointmentDetailsForDate } from '../utils.ts';

import { useRoutePlanner } from '../hooks/useRoutePlanner.ts';
import { useRouteMetrics } from '../hooks/useRouteMetrics.ts';
import RouteSidebar from './RouteSidebar.tsx';
import RouteMap from './RouteMap.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

// Declare google for TS
declare const google: any;

// --- TYPE DEFINITIONS ---
interface AddStopModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { type: 'supplier' | 'place', id?: string, data?: PlaceStopData, nextAction: 'return' | 'continue' }) => void;
    suppliers: Supplier[];
    previousStop?: RouteStop;
    nextStop?: RouteStop;
    isMapsLoaded: boolean;
}

// --- MODAL COMPONENT ---
const AddStopModal: React.FC<AddStopModalProps> = ({ isOpen, onClose, onSave, suppliers, previousStop, nextStop, isMapsLoaded }) => {
    const [activeTab, setActiveTab] = useState<'supplier' | 'place'>('supplier');
    
    // Supplier Tab State
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    
    // Place Search Tab State
    const [placeSearch, setPlaceSearch] = useState('');
    const [searchResults, setSearchResults] = useState<PlaceStopData[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<PlaceStopData | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    
    // Common State
    const [nextAction, setNextAction] = useState<'return' | 'continue' | null>('continue');

    useEffect(() => {
        if (isOpen) {
            setSelectedSupplierId(suppliers[0]?.id || '');
            setNextAction('continue');
            setPlaceSearch('');
            setSearchResults([]);
            setSelectedPlace(null);
            setActiveTab('supplier');
            setIsSearching(false);
        }
    }, [isOpen, suppliers]);

    const handleSearch = () => {
        if (!placeSearch.trim() || !isMapsLoaded || !google) return;

        setIsSearching(true);
        setSearchResults([]);
        setSelectedPlace(null);

        const performSearch = (location?: { lat: number, lng: number }) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            
            const request: any = {
                query: placeSearch,
                fields: ['name', 'formatted_address', 'geometry'],
            };

            // If we have a location, bias the search
            if (location) {
                request.location = new google.maps.LatLng(location.lat, location.lng);
                request.radius = 5000; // 5km radius bias
            }

            service.textSearch(request, (results: any[], status: any) => {
                setIsSearching(false);
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    const formattedResults = results.map(place => ({
                        name: place.name || 'Unknown Place',
                        address: place.formatted_address || place.name || 'Unknown Address'
                    }));
                    setSearchResults(formattedResults);
                } else {
                    setSearchResults([]);
                }
            });
        };

        // Try to get user location for better results
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    performSearch({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                () => {
                    // Geolocation failed or denied, search without location bias
                    performSearch();
                }
            );
        } else {
            performSearch();
        }
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nextAction) return;

        if (activeTab === 'supplier' && selectedSupplierId) {
            onSave({ type: 'supplier', id: selectedSupplierId, nextAction });
        } else if (activeTab === 'place' && selectedPlace) {
            onSave({ type: 'place', data: selectedPlace, nextAction });
        }
    };

    const handleSelectPlace = (place: PlaceStopData) => {
        setSelectedPlace(place);
        setPlaceSearch(place.name); // Update input to show selection
        setSearchResults([]); // Clear results to show selection state
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

    const isSubmitDisabled = activeTab === 'supplier' ? !selectedSupplierId : !selectedPlace;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Stop to Route</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button 
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'supplier' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        onClick={() => setActiveTab('supplier')}
                    >
                        Saved Supplier
                    </button>
                    <button 
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'place' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        onClick={() => setActiveTab('place')}
                    >
                        Search Nearby
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="p-6 space-y-6 overflow-y-auto">
                        
                        {activeTab === 'supplier' ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Select Supplier</label>
                                {suppliers.length > 0 ? (
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <BuildingStorefrontIcon className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="block w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white" required>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-500 dark:text-slate-400 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600 text-center">
                                        <p>No suppliers saved.</p>
                                        <button type="button" className="text-sky-600 hover:underline mt-1" onClick={() => {/* Navigate to settings? */}}>Go to Settings to add suppliers.</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col h-full min-h-[300px]">
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Search Google Maps</label>
                                <div className="flex gap-2 mb-2">
                                    <div className="relative flex-grow">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <SearchIcon className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder='e.g. "Gas Station", "Home Depot"'
                                            value={placeSearch}
                                            onChange={(e) => {
                                                setPlaceSearch(e.target.value);
                                                if (selectedPlace) setSelectedPlace(null);
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                                            className="block w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white"
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleSearch}
                                        disabled={isSearching || !placeSearch.trim()}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                                    >
                                        {isSearching ? '...' : 'Search'}
                                    </button>
                                </div>

                                {/* Results List */}
                                <div className="flex-grow overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/50 max-h-[200px]">
                                    {isSearching ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">Searching nearby...</div>
                                    ) : selectedPlace ? (
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 m-2 rounded-md border border-green-200 dark:border-green-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MapPinIcon className="w-4 h-4 text-green-600" />
                                                <span className="text-sm font-bold text-green-800 dark:text-green-300">Selected Stop</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedPlace.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedPlace.address}</p>
                                            <button 
                                                type="button" 
                                                onClick={() => { setSelectedPlace(null); handleSearch(); }}
                                                className="text-xs text-green-600 hover:text-green-700 underline mt-2"
                                            >
                                                Change Selection
                                            </button>
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {searchResults.map((result, idx) => (
                                                <li key={idx}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleSelectPlace(result)}
                                                        className="w-full text-left p-3 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex items-start gap-3"
                                                    >
                                                        <MapIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{result.name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{result.address}</p>
                                                        </div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : placeSearch && !isSearching && !selectedPlace ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">
                                            No results found nearby. Try a different term.
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-slate-400 text-sm">
                                            Enter a term (e.g. "Gas Station") and click Search. We'll find places near you.
                                        </div>
                                    )}
                                </div>
                                {!isMapsLoaded && (
                                    <p className="text-xs text-amber-600 mt-1">Map service loading...</p>
                                )}
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">What happens next?</label>
                            <div className="space-y-3">
                                <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${nextAction === 'continue' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input type="radio" name="nextAction" value="continue" checked={nextAction === 'continue'} onChange={() => setNextAction('continue')} className="mt-1 h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"/>
                                    <div className="ml-3 text-sm">
                                        <span className="font-medium text-slate-800 dark:text-slate-100">Continue to Next Stop</span>
                                        <p className="text-slate-500 dark:text-slate-400">Proceed to {nextStopName} after this stop.</p>
                                    </div>
                                </label>
                                <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${!canReturn ? 'opacity-50 cursor-not-allowed' : ''} ${nextAction === 'return' ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input type="radio" name="nextAction" value="return" checked={nextAction === 'return'} onChange={() => setNextAction('return')} disabled={!canReturn} className="mt-1 h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"/>
                                    <div className="ml-3 text-sm">
                                        <span className="font-medium text-slate-800 dark:text-slate-100">Return to Previous Job</span>
                                        <p className="text-slate-500 dark:text-slate-400">{canReturn ? `Go back to ${previousJobName} after this stop.` : 'Cannot return from Home.'}</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2 border-t dark:border-slate-700 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:text-slate-200">Cancel</button>
                        <button type="submit" disabled={isSubmitDisabled || !nextAction} className="px-4 py-2 rounded-md text-sm text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 dark:disabled:bg-sky-800 disabled:cursor-not-allowed">Add to Route</button>
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
                if (stop.type === 'place') return { type: stop.type, id: stop.id, placeName: (stop.data as PlaceStopData).name, placeAddress: (stop.data as PlaceStopData).address };
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
            if (currentStop.type === 'supplier' || currentStop.type === 'place') {
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
                // Fallback logic for deleted anchors
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
    
        if (stopToDelete.type === 'supplier' || stopToDelete.type === 'place') {
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
                if (stop.type === 'place') return { type: stop.type, id: stop.id, placeName: (stop.data as PlaceStopData).name, placeAddress: (stop.data as PlaceStopData).address };
                return { type: stop.type, supplierId: (stop.data as Supplier).id, id: stop.id };
            });
            handleSaveRoute(selectedDate, simplifiedRoute);
        }
    };

    const handleAddStop = ({ type, id, data, nextAction }: { type: 'supplier' | 'place', id?: string, data?: PlaceStopData, nextAction: 'return' | 'continue' }) => {
        if (addStopIndex === null) return;
        
        let newStop: RouteStop;

        if (type === 'supplier' && id) {
            const supplier = (businessInfo.suppliers || []).find(s => s.id === id);
            if (!supplier) return;
            newStop = { type: 'supplier', id: `supplier-${generateId()}`, data: supplier };
        } else if (type === 'place' && data) {
            newStop = { type: 'place', id: `place-${generateId()}`, data: data };
        } else {
            return;
        }

        const newStops = [...routeStops];

        if (nextAction === 'return') {
            const previousJob = routeStops[addStopIndex - 1];
            if (previousJob && previousJob.type === 'job') {
                const returnJobStop: RouteStop = { ...previousJob, id: `${(previousJob.data as JobStopData).id.split('-')[0]}-${Date.now()}` };
                newStops.splice(addStopIndex, 0, newStop, returnJobStop);
            } else {
                 newStops.splice(addStopIndex, 0, newStop);
            }
        } else {
            newStops.splice(addStopIndex, 0, newStop);
        }
        
        const simplifiedRoute: SavedRouteStop[] = newStops.map((stop): SavedRouteStop => {
            if (stop.type === 'home') return { type: stop.type, label: (stop.data as HomeStopData).label };
            if (stop.type === 'job') return { type: stop.type, jobId: stop.id, contactId: (stop.data as JobStopData).contactId };
            if (stop.type === 'place') return { type: stop.type, id: stop.id, placeName: (stop.data as PlaceStopData).name, placeAddress: (stop.data as PlaceStopData).address };
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
            onSave={handleAddStop}
            suppliers={businessInfo.suppliers || []}
            previousStop={addStopIndex ? routeStops[addStopIndex - 1] : undefined}
            nextStop={addStopIndex ? routeStops[addStopIndex] : undefined}
            isMapsLoaded={isMapsLoaded}
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