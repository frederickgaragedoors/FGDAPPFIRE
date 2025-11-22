
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Contact, MapSettings, JobTicket } from '../types.ts';
import { ArrowLeftIcon, CarIcon, HomeIcon, MapPinIcon } from './icons.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { formatTime } from '../utils.ts';

// Declare google for TS
declare const google: any;

interface RouteViewProps {
    contacts: Contact[];
    mapSettings: MapSettings;
    onGoToSettings: () => void;
    onBack: () => void;
}

interface RouteMetrics {
    travelTimeText: string;
    travelTimeValue: number; // seconds
    estimatedArrival: Date;
    status: 'on_time' | 'late' | 'early';
    delayMinutes: number;
}

const RouteView: React.FC<RouteViewProps> = ({ contacts, mapSettings, onGoToSettings, onBack }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [routeError, setRouteError] = useState<string | null>(null);
    
    // New state for timing logic
    const [leaveHomeTime, setLeaveHomeTime] = useState<Date | null>(null);
    const [homeArrivalTime, setHomeArrivalTime] = useState<Date | null>(null);
    const [jobMetrics, setJobMetrics] = useState<Record<string, RouteMetrics>>({});
    const [totalDriveTime, setTotalDriveTime] = useState<string>('');
    const [totalDistance, setTotalDistance] = useState<string>('');

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const directionsRendererRef = useRef<any>(null);
    const userLocationMarkerRef = useRef<any>(null);

    const { isLoaded: mapLoaded, error: mapError } = useGoogleMaps(mapSettings.apiKey);

    // Filter jobs for selected date
    const dailyJobs = useMemo(() => {
        const jobs: (JobTicket & { contactName: string; contactAddress: string })[] = [];
        contacts.forEach(contact => {
            (contact.jobTickets || []).forEach(ticket => {
                if (ticket.date === selectedDate && ticket.status !== 'Declined') {
                    jobs.push({
                        ...ticket,
                        contactName: contact.name,
                        contactAddress: contact.address
                    });
                }
            });
        });
        // Sort by time if available
        return jobs.sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
    }, [contacts, selectedDate]);

    useEffect(() => {
        if (mapError) {
             setRouteError("Failed to load Google Maps. Please check your API Key.");
        }
    }, [mapError]);

    useEffect(() => {
        if (mapLoaded && mapRef.current && !mapInstanceRef.current) {
            const center = { lat: 39.8283, lng: -98.5795 }; // Center of US
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
                center,
                zoom: 4,
            });
            directionsRendererRef.current = new google.maps.DirectionsRenderer({
                map: mapInstanceRef.current,
                suppressMarkers: false, // Let renderer handle standard markers, or set to true for custom
            });
        }
    }, [mapLoaded]);

    // Live Location Tracking
    useEffect(() => {
        if (mapLoaded && mapInstanceRef.current && navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };

                    if (!userLocationMarkerRef.current) {
                        // Create marker
                         userLocationMarkerRef.current = new google.maps.Marker({
                            position: pos,
                            map: mapInstanceRef.current,
                            title: "Current Location",
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#3b82f6", // Tailwind blue-500
                                fillOpacity: 1,
                                strokeColor: "white",
                                strokeWeight: 2,
                            },
                            zIndex: 999
                        });
                    } else {
                        // Update position
                        userLocationMarkerRef.current.setPosition(pos);
                    }
                },
                () => {
                    console.warn("Unable to retrieve your location");
                }
            );
            
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, [mapLoaded]);

    useEffect(() => {
        if (!mapInstanceRef.current || !mapLoaded) return;

        // Clear existing markers and state
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        setRouteError(null);
        setLeaveHomeTime(null);
        setHomeArrivalTime(null);
        setJobMetrics({});
        setTotalDriveTime('');
        setTotalDistance('');

        if (dailyJobs.length === 0) {
             if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
             return;
        }

        const geocoder = new google.maps.Geocoder();
        const directionsService = new google.maps.DirectionsService();

        // Determine Start Point
        const origin = mapSettings.homeAddress || (dailyJobs[0].jobLocation || dailyJobs[0].contactAddress);
        
        if (!origin) {
            setRouteError("No valid start location found.");
            return;
        }

        // Prepare Waypoints
        // API Limit: 25 waypoints (plus origin/dest). We assume simple usage here.
        const waypoints = dailyJobs.map(job => ({
            location: job.jobLocation || job.contactAddress,
            stopover: true
        })).filter(wp => wp.location);

        if (waypoints.length === 0) {
             setRouteError("No jobs with valid addresses for this date.");
             return;
        }

        const request: any = {
            origin: origin,
            destination: origin, // Round trip by default if home address exists
            waypoints: waypoints,
            optimizeWaypoints: false, // False to keep schedule order
            travelMode: google.maps.TravelMode.DRIVING,
        };

        // Special handling if no home address set: Linear route from Job 1 -> Job Last
        if (!mapSettings.homeAddress) {
             if (waypoints.length > 1) {
                 request.origin = waypoints[0].location;
                 request.destination = waypoints[waypoints.length - 1].location;
                 request.waypoints = waypoints.slice(1, -1);
             } else {
                 // Single job, no home address -> Just show marker via Geocoder
                 geocoder.geocode({ address: waypoints[0].location }, (results: any, status: any) => {
                     if (status === 'OK' && results[0]) {
                         const marker = new google.maps.Marker({
                             map: mapInstanceRef.current,
                             position: results[0].geometry.location,
                             title: dailyJobs[0].contactName
                         });
                         markersRef.current.push(marker);
                         mapInstanceRef.current.setCenter(results[0].geometry.location);
                         mapInstanceRef.current.setZoom(12);
                         if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
                     }
                 });
                 return;
             }
        }

        directionsService.route(request, (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRendererRef.current.setDirections(result);
                
                // --- TIMING LOGIC ---
                const route = result.routes[0];
                const legs = route.legs;
                let totalDist = 0;
                let totalDur = 0;

                // Helper to parse "HH:MM" to Date for the specific selected date
                const parseJobDate = (timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const d = new Date(selectedDate);
                    d.setHours(h, m, 0, 0);
                    return d;
                };

                // 1. Calculate "Leave Home By" based on first job
                if (dailyJobs.length > 0 && dailyJobs[0].time) {
                    const firstJobStart = parseJobDate(dailyJobs[0].time);
                    const firstLegDurationSecs = legs[0].duration.value; // seconds
                    
                    // Leave time = First Job Start - Travel Time
                    const leaveTime = new Date(firstJobStart.getTime() - (firstLegDurationSecs * 1000));
                    setLeaveHomeTime(leaveTime);
                }

                // 2. Calculate domino effect for schedule
                const newMetrics: Record<string, RouteMetrics> = {};
                let currentClock: Date | null = null;

                // If we have a start time, set the clock to start at first job start time
                if (dailyJobs.length > 0 && dailyJobs[0].time) {
                    currentClock = parseJobDate(dailyJobs[0].time);
                }

                // Loop through jobs
                dailyJobs.forEach((job, index) => {
                    // Metric is for the travel TO this job
                    const legIndex = mapSettings.homeAddress ? index : index - 1; 
                    
                    // Special case: No home address, first job has no travel metric visible in this context (it's the origin)
                    if (!mapSettings.homeAddress && index === 0) return;

                    const leg = legs[legIndex >= 0 ? legIndex : 0]; // Fallback for safety
                    
                    if (!leg) return;

                    if (mapSettings.homeAddress && index === 0) {
                        // Home -> Job 1
                        // We assume on time for first job
                        newMetrics[job.id] = {
                            travelTimeText: leg.duration.text,
                            travelTimeValue: leg.duration.value,
                            estimatedArrival: parseJobDate(job.time || '09:00'),
                            status: 'on_time',
                            delayMinutes: 0
                        };
                        
                        // Advance clock: Job Start + Duration (Default 60 mins)
                        if (currentClock) {
                            const durationMins = job.duration || 60;
                            currentClock = new Date(currentClock.getTime() + (durationMins * 60000));
                        }
                    } else {
                        // Job (N-1) -> Job N
                        const travelSeconds = leg.duration.value;
                        
                        if (currentClock) {
                            // Arrival at Job N = (Finish Job N-1) + Travel
                            const arrivalAtJob = new Date(currentClock.getTime() + (travelSeconds * 1000));
                            
                            let status: RouteMetrics['status'] = 'on_time';
                            let delayMinutes = 0;

                            if (job.time) {
                                const scheduledTime = parseJobDate(job.time);
                                const diffMs = arrivalAtJob.getTime() - scheduledTime.getTime();
                                const diffMins = Math.round(diffMs / 60000);

                                if (diffMins > 15) {
                                    status = 'late';
                                    delayMinutes = diffMins;
                                } else if (diffMins < -15) {
                                    status = 'early';
                                    delayMinutes = Math.abs(diffMins);
                                }
                                
                                // Update clock: Actual Start + Duration (Default 60 mins)
                                // If late, we start late. If early, we assume we start at scheduled time.
                                const actualStart = arrivalAtJob.getTime() > scheduledTime.getTime() ? arrivalAtJob : scheduledTime;
                                const durationMins = job.duration || 60;
                                currentClock = new Date(actualStart.getTime() + (durationMins * 60000));
                            } else {
                                // No scheduled time, just add duration to arrival
                                const durationMins = job.duration || 60;
                                currentClock = new Date(arrivalAtJob.getTime() + (durationMins * 60000));
                            }

                            newMetrics[job.id] = {
                                travelTimeText: leg.duration.text,
                                travelTimeValue: leg.duration.value,
                                estimatedArrival: arrivalAtJob,
                                status,
                                delayMinutes
                            };
                        }
                    }
                });

                setJobMetrics(newMetrics);
                
                // 3. Calculate "Back Home" time
                // If we have a home address, there is one final leg: Last Job -> Home
                if (mapSettings.homeAddress && currentClock) {
                    // legs.length should be dailyJobs.length + 1 (Home->J1 ... Jn->Home)
                    // The last leg index is dailyJobs.length
                    const returnLeg = legs[dailyJobs.length];
                    if (returnLeg) {
                         const arriveHome = new Date(currentClock.getTime() + (returnLeg.duration.value * 1000));
                         setHomeArrivalTime(arriveHome);
                    }
                }

                // Aggregate Totals
                legs.forEach((leg: any) => {
                    totalDist += leg.distance.value;
                    totalDur += leg.duration.value;
                });
                
                setTotalDistance((totalDist / 1609.34).toFixed(1) + ' mi'); // Meters to Miles
                
                const hours = Math.floor(totalDur / 3600);
                const mins = Math.floor((totalDur % 3600) / 60);
                setTotalDriveTime(`${hours > 0 ? hours + 'h ' : ''}${mins}m driving`);

            } else {
                console.error("Directions request failed due to " + status);
                setRouteError("Could not calculate route. Check addresses.");
            }
        });

    }, [dailyJobs, mapSettings.homeAddress, mapLoaded]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800">
            <div className="p-4 flex items-center border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden">
                    <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>
                <h2 className="ml-4 flex-grow font-bold text-lg text-slate-700 dark:text-slate-200">
                    Route Planner
                </h2>
                <div className="flex space-x-2">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    />
                </div>
            </div>

            {!mapSettings.apiKey ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg max-w-md">
                        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Google Maps API Key Required</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">To view routes and maps, you need to configure your Google Maps API Key in settings.</p>
                        <button 
                            onClick={onGoToSettings}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            Go to Settings
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row flex-grow h-full overflow-hidden">
                    {/* Sidebar: Job List */}
                    <div className="w-full lg:w-1/3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 order-2 lg:order-1 h-1/2 lg:h-full">
                        
                        {/* Route Summary Header */}
                        <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                {new Date(selectedDate).toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}
                            </h3>
                            
                            {leaveHomeTime && (
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Leave Home</span>
                                    <span className="text-sky-600 dark:text-sky-400 font-bold text-lg">
                                        {formatTime(`${leaveHomeTime.getHours()}:${String(leaveHomeTime.getMinutes()).padStart(2, '0')}`)}
                                    </span>
                                </div>
                            )}

                            {homeArrivalTime && (
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Arrive Home</span>
                                    <span className="text-slate-700 dark:text-slate-200 font-bold text-lg">
                                        {formatTime(`${homeArrivalTime.getHours()}:${String(homeArrivalTime.getMinutes()).padStart(2, '0')}`)}
                                    </span>
                                </div>
                            )}
                            
                            {totalDriveTime && (
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mt-2">
                                    <span>Total Distance: {totalDistance}</span>
                                    <span>{totalDriveTime}</span>
                                </div>
                            )}
                        </div>

                        {dailyJobs.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400 italic">No jobs scheduled for this date.</p>
                        ) : (
                            <ul className="space-y-3 relative pb-4">
                                {/* Line connector visual could go here */}
                                {dailyJobs.map((job, index) => {
                                    const metrics = jobMetrics[job.id];
                                    
                                    return (
                                    <li key={job.id} className="relative">
                                        {/* Travel Time Connector */}
                                        {metrics && metrics.travelTimeText && (
                                            <div className="flex items-center ml-4 mb-2 text-xs text-slate-500 dark:text-slate-400">
                                                <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600 mx-auto mr-2"></div>
                                                <CarIcon className="w-3 h-3 mr-1" />
                                                <span>{metrics.travelTimeText} drive</span>
                                            </div>
                                        )}

                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 z-10 relative">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-800 dark:text-slate-100">{job.contactName}</span>
                                                        {metrics && metrics.status !== 'on_time' && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                                metrics.status === 'late' 
                                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                                                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                            }`}>
                                                                {metrics.status === 'late' ? `${metrics.delayMinutes}m Late` : `${metrics.delayMinutes}m Early`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{job.jobLocation || job.contactAddress}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 block mb-1">
                                                        {job.time ? formatTime(job.time) : 'Anytime'}
                                                    </span>
                                                    {metrics && metrics.estimatedArrival && job.time && (
                                                         <span className={`text-[10px] block ${
                                                             metrics.status === 'late' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                                                         }`}>
                                                             ETA: {formatTime(`${metrics.estimatedArrival.getHours()}:${String(metrics.estimatedArrival.getMinutes()).padStart(2,'0')}`)}
                                                         </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                                <span className="text-xs text-slate-400">Duration: {job.duration || 60}m</span>
                                                <a
                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.jobLocation || job.contactAddress)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors z-20 relative"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MapPinIcon className="w-3 h-3" />
                                                    <span>Navigate</span>
                                                </a>
                                            </div>
                                        </div>
                                    </li>
                                )})}
                                {homeArrivalTime && (
                                    <li className="relative">
                                        <div className="flex items-center ml-4 mb-2 text-xs text-slate-500 dark:text-slate-400">
                                            <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600 mx-auto mr-2"></div>
                                            <CarIcon className="w-3 h-3 mr-1" />
                                            <span>Return trip</span>
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 flex items-center text-slate-500 dark:text-slate-400">
                                            <HomeIcon className="w-4 h-4 mr-2" />
                                            <span className="text-sm font-medium">Back Home by {formatTime(`${homeArrivalTime.getHours()}:${String(homeArrivalTime.getMinutes()).padStart(2, '0')}`)}</span>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* Map Panel */}
                    <div className="w-full lg:w-2/3 aspect-square lg:aspect-auto bg-slate-200 relative order-1 lg:order-2 h-1/2 lg:h-full">
                        <div ref={mapRef} className="w-full h-full"></div>
                        {routeError && (
                            <div className="absolute top-4 left-4 bg-red-100 text-red-800 p-3 rounded shadow-md max-w-sm text-sm z-10">
                                {routeError}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteView;
