import React, { useState, useEffect, useRef, useMemo } from 'react';
import { JobTicket } from '../types.ts';
import { useData } from '../contexts/DataContext.tsx';
import { ArrowLeftIcon, CarIcon, HomeIcon, MapPinIcon } from './icons.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { formatTime } from '../utils.ts';

// Declare google for TS
declare const google: any;

interface RouteViewProps {
    onGoToSettings: () => void;
    onBack: () => void;
    onViewJobDetail: (contactId: string, ticketId: string) => void;
    initialDate?: string;
}

interface RouteMetrics {
    travelTimeText: string;
    travelTimeValue: number; // seconds
    estimatedArrival: Date;
    status: 'on_time' | 'late' | 'early';
    delayMinutes: number;
}

const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const RouteView: React.FC<RouteViewProps> = ({ onGoToSettings, onBack, onViewJobDetail, initialDate }) => {
    const { contacts, mapSettings } = useData();
    const [selectedDate, setSelectedDate] = useState(() => initialDate || getLocalDateString(new Date()));
    
    const [routeCalculationError, setRouteCalculationError] = useState<string | null>(null);
    const [leaveHomeTime, setLeaveHomeTime] = useState<Date | null>(null);
    const [homeArrivalTime, setHomeArrivalTime] = useState<Date | null>(null);
    const [jobMetrics, setJobMetrics] = useState<Record<string, RouteMetrics>>({});
    const [totalDriveTime, setTotalDriveTime] = useState<string>('');
    const [totalDistance, setTotalDistance] = useState<string>('');

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const directionsRendererRef = useRef<any>(null);
    const userLocationMarkerRef = useRef<any>(null);

    const { isLoaded: mapLoaded, error: mapError } = useGoogleMaps(mapSettings?.apiKey);

    const dailyJobs = useMemo(() => {
        const jobs: (JobTicket & { contactName: string; contactAddress: string; contactId: string })[] = [];
        (contacts || []).forEach(contact => {
            (contact.jobTickets || []).forEach(ticket => {
                const history = ticket.statusHistory && ticket.statusHistory.length > 0
                    ? [...ticket.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    : [{ status: ticket.status, timestamp: ticket.createdAt || ticket.date, id: 'fallback' }];
                
                const latestStatusEntry = history[0];
                const timestamp = latestStatusEntry.timestamp;
                const hasTime = timestamp.includes('T');
                const displayDate = hasTime ? new Date(timestamp) : new Date(`${timestamp}T00:00:00`);

                const localDateString = getLocalDateString(displayDate);
                
                const isRoutableStatus = ticket.status === 'Estimate Scheduled' || ticket.status === 'Scheduled';

                if (localDateString === selectedDate && isRoutableStatus) {
                    let effectiveTime: string | undefined;
                    if (hasTime) {
                        const hours = String(displayDate.getHours()).padStart(2, '0');
                        const minutes = String(displayDate.getMinutes()).padStart(2, '0');
                        effectiveTime = `${hours}:${minutes}`;
                    } else {
                        effectiveTime = ticket.time;
                    }
                    
                    const effectiveDuration = latestStatusEntry.duration ?? ticket.duration;

                    jobs.push({
                        ...ticket,
                        date: localDateString, 
                        time: effectiveTime,
                        duration: effectiveDuration,
                        contactId: contact.id,
                        contactName: contact.name,
                        contactAddress: contact.address
                    });
                }
            });
        });
        return jobs.sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
    }, [contacts, selectedDate]);

    useEffect(() => {
        if (mapLoaded && mapRef.current && !mapInstanceRef.current) {
            const center = { lat: 39.8283, lng: -98.5795 };
            mapInstanceRef.current = new google.maps.Map(mapRef.current, { center, zoom: 4 });
            directionsRendererRef.current = new google.maps.DirectionsRenderer({ map: mapInstanceRef.current });
        }
    }, [mapLoaded]);

    useEffect(() => {
        if (mapLoaded && mapInstanceRef.current && navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                    if (!userLocationMarkerRef.current) {
                         userLocationMarkerRef.current = new google.maps.Marker({
                            position: pos,
                            map: mapInstanceRef.current,
                            title: "Current Location",
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#3b82f6",
                                fillOpacity: 1,
                                strokeColor: "white",
                                strokeWeight: 2,
                            },
                            zIndex: 999
                        });
                    } else {
                        userLocationMarkerRef.current.setPosition(pos);
                    }
                },
                () => console.warn("Unable to retrieve your location")
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, [mapLoaded]);

    useEffect(() => {
        if (!mapInstanceRef.current || !mapLoaded || mapError) return;

        setRouteCalculationError(null);
        setLeaveHomeTime(null);
        setHomeArrivalTime(null);
        setJobMetrics({});
        setTotalDriveTime('');
        setTotalDistance('');

        if (dailyJobs.length === 0) {
             if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
             return;
        }

        const directionsService = new google.maps.DirectionsService();
        const origin = mapSettings?.homeAddress || (dailyJobs[0].jobLocation || dailyJobs[0].contactAddress);
        
        if (!origin) {
            setRouteCalculationError("No valid start location found.");
            return;
        }

        const waypoints = dailyJobs.map(job => ({
            location: job.jobLocation || job.contactAddress,
            stopover: true
        })).filter(wp => wp.location);

        if (waypoints.length === 0) {
             setRouteCalculationError("No jobs with valid addresses for this date.");
             return;
        }

        const request: any = {
            origin: origin,
            destination: origin,
            waypoints: waypoints,
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING,
        };

        if (!mapSettings?.homeAddress) {
             if (waypoints.length > 1) {
                 request.origin = waypoints[0].location;
                 request.destination = waypoints[waypoints.length - 1].location;
                 request.waypoints = waypoints.slice(1, -1);
             } else {
                 if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
                 return;
             }
        }

        directionsService.route(request, (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRendererRef.current.setDirections(result);
                
                const route = result.routes[0];
                const legs = route.legs;
                let totalDist = 0;
                let totalDur = 0;

                const parseJobDate = (timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const [y, mo, d] = selectedDate.split('-').map(Number);
                    const dateObj = new Date(y, mo - 1, d, h, m, 0, 0);
                    return dateObj;
                };

                if (dailyJobs.length > 0 && dailyJobs[0].time) {
                    const firstJobStart = parseJobDate(dailyJobs[0].time);
                    const firstLegDurationSecs = legs[0].duration.value;
                    const leaveTime = new Date(firstJobStart.getTime() - (firstLegDurationSecs * 1000));
                    setLeaveHomeTime(leaveTime);
                }

                const newMetrics: Record<string, RouteMetrics> = {};
                let currentClock: Date | null = dailyJobs.length > 0 && dailyJobs[0].time ? parseJobDate(dailyJobs[0].time) : null;

                dailyJobs.forEach((job, index) => {
                    const legIndex = mapSettings?.homeAddress ? index : index - 1; 
                    if (!mapSettings?.homeAddress && index === 0) return;
                    const leg = legs[legIndex >= 0 ? legIndex : 0];
                    if (!leg) return;

                    if (mapSettings?.homeAddress && index === 0) {
                        newMetrics[job.id] = {
                            travelTimeText: leg.duration.text,
                            travelTimeValue: leg.duration.value,
                            estimatedArrival: parseJobDate(job.time || '09:00'),
                            status: 'on_time',
                            delayMinutes: 0
                        };
                        if (currentClock) {
                            currentClock = new Date(currentClock.getTime() + ((job.duration || 60) * 60000));
                        }
                    } else if (currentClock) {
                        const arrivalAtJob = new Date(currentClock.getTime() + (leg.duration.value * 1000));
                        let status: RouteMetrics['status'] = 'on_time';
                        let delayMinutes = 0;

                        if (job.time) {
                            const scheduledTime = parseJobDate(job.time);
                            const diffMins = Math.round((arrivalAtJob.getTime() - scheduledTime.getTime()) / 60000);
                            if (diffMins > 15) { status = 'late'; delayMinutes = diffMins; }
                            else if (diffMins < -15) { status = 'early'; delayMinutes = Math.abs(diffMins); }
                            
                            const actualStart = arrivalAtJob > scheduledTime ? arrivalAtJob : scheduledTime;
                            currentClock = new Date(actualStart.getTime() + ((job.duration || 60) * 60000));
                        } else {
                            currentClock = new Date(arrivalAtJob.getTime() + ((job.duration || 60) * 60000));
                        }

                        newMetrics[job.id] = {
                            travelTimeText: leg.duration.text,
                            travelTimeValue: leg.duration.value,
                            estimatedArrival: arrivalAtJob,
                            status,
                            delayMinutes
                        };
                    }
                });

                setJobMetrics(newMetrics);
                
                if (mapSettings?.homeAddress && currentClock) {
                    const returnLeg = legs[dailyJobs.length];
                    if (returnLeg) {
                         const arriveHome = new Date(currentClock.getTime() + (returnLeg.duration.value * 1000));
                         setHomeArrivalTime(arriveHome);
                    }
                }

                legs.forEach((leg: any) => {
                    totalDist += leg.distance.value;
                    totalDur += leg.duration.value;
                });
                
                setTotalDistance((totalDist / 1609.34).toFixed(1) + ' mi');
                const hours = Math.floor(totalDur / 3600);
                const mins = Math.floor((totalDur % 3600) / 60);
                setTotalDriveTime(`${hours > 0 ? hours + 'h ' : ''}${mins}m driving`);
            } else {
                setRouteCalculationError("Could not calculate route. Check addresses.");
            }
        });

    }, [dailyJobs, mapSettings?.homeAddress, mapLoaded, mapError]);

    const getDisplayDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const FullScreenError: React.FC<{title: string, message: string, buttonText: string, onButtonClick: () => void, variant: 'warning' | 'error'}> = 
    ({title, message, buttonText, onButtonClick, variant}) => {
        const colors = variant === 'warning' ? {
            bg: 'bg-yellow-50 dark:bg-yellow-900/20',
            title: 'text-yellow-800 dark:text-yellow-200',
            text: 'text-yellow-700 dark:text-yellow-300',
            button: 'bg-yellow-600 hover:bg-yellow-700'
        } : {
            bg: 'bg-red-50 dark:bg-red-900/20',
            title: 'text-red-800 dark:text-red-200',
            text: 'text-red-700 dark:text-red-300',
            button: 'bg-red-600 hover:bg-red-700'
        };

        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900">
                <div className={`${colors.bg} p-6 rounded-lg max-w-md`}>
                    <h3 className={`text-lg font-semibold ${colors.title} mb-2`}>{title}</h3>
                    <p className={`text-sm ${colors.text} mb-4`}>{message}</p>
                    <button onClick={onButtonClick} className={`px-4 py-2 ${colors.button} text-white rounded-md text-sm font-medium transition-colors`}>{buttonText}</button>
                </div>
            </div>
        );
    };

    const todayStr = getLocalDateString(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrowDate);

    const buttonClass = (active: boolean) => 
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active 
            ? 'bg-sky-500 text-white shadow-sm' 
            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
        }`;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800">
            <div className="p-4 flex flex-wrap items-center justify-between gap-y-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                <div className="flex items-center">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden">
                        <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                    <h2 className="ml-4 md:ml-0 font-bold text-lg text-slate-700 dark:text-slate-200">Route Planner</h2>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button onClick={() => setSelectedDate(todayStr)} className={`${buttonClass(selectedDate === todayStr)} flex-1 sm:flex-auto`}>Today</button>
                    <button onClick={() => setSelectedDate(tomorrowStr)} className={`${buttonClass(selectedDate === tomorrowStr)} flex-1 sm:flex-auto`}>Tomorrow</button>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex-grow" />
                </div>
            </div>

            {!mapSettings?.apiKey ? (
                <FullScreenError
                    variant="warning"
                    title="Google Maps API Key Required"
                    message="To view routes and maps, configure your API Key in settings."
                    buttonText="Go to Settings"
                    onButtonClick={onGoToSettings}
                />
            ) : mapError ? (
                 <FullScreenError
                    variant="error"
                    title="Map Loading Error"
                    message={mapError.message}
                    buttonText="Check API Key in Settings"
                    onButtonClick={onGoToSettings}
                />
            ) : (
                <div className="flex flex-col lg:flex-row flex-grow h-full overflow-hidden">
                    <div className="w-full lg:w-1/3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 order-2 lg:order-1 h-1/2 lg:h-full">
                        <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{getDisplayDate(selectedDate).toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}</h3>
                            {leaveHomeTime && <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Leave Home</span><span className="text-sky-600 dark:text-sky-400 font-bold text-lg">{formatTime(`${leaveHomeTime.getHours()}:${String(leaveHomeTime.getMinutes()).padStart(2, '0')}`)}</span></div>}
                            {homeArrivalTime && <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Arrive Home</span><span className="text-slate-700 dark:text-slate-200 font-bold text-lg">{formatTime(`${homeArrivalTime.getHours()}:${String(homeArrivalTime.getMinutes()).padStart(2, '0')}`)}</span></div>}
                            {totalDriveTime && <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mt-2"><span>Total Distance: {totalDistance}</span><span>{totalDriveTime}</span></div>}
                        </div>
                        {dailyJobs.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400 italic">No jobs scheduled for this date.</p>
                        ) : (
                            <ul className="space-y-3 relative pb-4">
                                {dailyJobs.map((job, index) => {
                                    const metrics = jobMetrics[job.id];
                                    return (
                                    <li key={job.id} className="relative">
                                        {metrics && metrics.travelTimeText && (
                                            <div className="flex items-center ml-4 mb-2 text-xs text-slate-500 dark:text-slate-400"><div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600 mx-auto mr-2"></div><CarIcon className="w-3 h-3 mr-1" /><span>{metrics.travelTimeText} drive</span></div>
                                        )}
                                        <div 
                                            className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 z-10 relative cursor-pointer hover:border-sky-500 dark:hover:border-sky-400 transition-colors"
                                            onClick={() => onViewJobDetail(job.contactId, job.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewJobDetail(job.contactId, job.id); }}}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2"><span className="font-medium text-slate-800 dark:text-slate-100">{job.contactName}</span>{metrics && metrics.status !== 'on_time' && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${metrics.status === 'late' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>{metrics.status === 'late' ? `${metrics.delayMinutes}m Late` : `${metrics.delayMinutes}m Early`}</span>}</div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{job.jobLocation || job.contactAddress}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 block mb-1">{job.time ? formatTime(job.time) : 'Anytime'}</span>
                                                    {metrics && metrics.estimatedArrival && job.time && <span className={`text-[10px] block ${metrics.status === 'late' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>ETA: {formatTime(`${metrics.estimatedArrival.getHours()}:${String(metrics.estimatedArrival.getMinutes()).padStart(2,'0')}`)}</span>}
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center"><span className="text-xs text-slate-400">Duration: {job.duration || 60}m</span><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.jobLocation || job.contactAddress)}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors z-20 relative" onClick={(e) => e.stopPropagation()}><MapPinIcon className="w-3 h-3" /><span>Navigate</span></a></div>
                                        </div>
                                    </li>
                                )})}
                                {homeArrivalTime && (
                                    <li className="relative"><div className="flex items-center ml-4 mb-2 text-xs text-slate-500 dark:text-slate-400"><div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600 mx-auto mr-2"></div><CarIcon className="w-3 h-3 mr-1" /><span>{jobMetrics[dailyJobs[dailyJobs.length - 1].id]?.travelTimeText} drive</span></div><div className="flex items-center space-x-2"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><HomeIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /></div><span className="font-medium text-slate-700 dark:text-slate-200">Arrive Home</span></div></li>
                                )}
                            </ul>
                        )}
                        {routeCalculationError && <p className="text-red-500 text-sm mt-4">{routeCalculationError}</p>}
                    </div>
                    <div className="flex-grow w-full lg:w-2/3 order-1 lg:order-2 h-1/2 lg:h-full">
                        <div ref={mapRef} className="w-full h-full bg-slate-200 dark:bg-slate-700"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteView;
