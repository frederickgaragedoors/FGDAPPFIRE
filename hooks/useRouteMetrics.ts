import { useState, useEffect } from 'react';
import { RouteStop, RouteMetrics, JobStopData } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { formatTime } from '../utils.ts';
import { useGoogleMaps } from './useGoogleMaps.ts';

declare const google: any;

export const useRouteMetrics = (routeStops: RouteStop[], selectedDate: string) => {
    const { mapSettings } = useApp();
    const { addNotification } = useNotifications();
    const { isLoaded: mapLoaded } = useGoogleMaps(mapSettings.apiKey);
    
    const [routeMetrics, setRouteMetrics] = useState<Record<string, RouteMetrics>>({});
    const [totalMetrics, setTotalMetrics] = useState({ distance: 0, time: 0 });
    const [leaveByTime, setLeaveByTime] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const calculateAllMetrics = async () => {
            // 1. Reset state to avoid showing stale data from previous calculations
            if (isMounted) {
                setRouteMetrics({});
                setTotalMetrics({ distance: 0, time: 0 });
                setLeaveByTime(null);
            }

            if (!isMounted || !mapLoaded || routeStops.length < 2) {
                return; // Exit if component unmounted, maps not ready, or no route to calculate
            }

            const directionsService = new google.maps.DirectionsService();
            let finalLeaveByTime: Date | null = null;

            // --- PART 1: EFFICIENT LEAVE-BY-TIME CALCULATION ---
            const firstJobIndex = routeStops.findIndex(s => s.type === 'job');
            if (firstJobIndex > 0) {
                const firstJob = routeStops[firstJobIndex] as RouteStop & { type: 'job' };
                // FIX: Add type cast to `JobStopData` to resolve error when accessing `time` property on a union type.
                const firstJobData = firstJob.data as JobStopData;
                if (firstJobData.time) {
                    const stopsToFirstJob = routeStops.slice(0, firstJobIndex + 1);
                    const request = {
                        origin: stopsToFirstJob[0].data.address,
                        destination: stopsToFirstJob[stopsToFirstJob.length - 1].data.address,
                        waypoints: stopsToFirstJob.slice(1, -1).map(stop => ({ location: stop.data.address, stopover: true })),
                        travelMode: google.maps.TravelMode.DRIVING,
                        drivingOptions: {
                            departureTime: new Date(), // Use now for traffic prediction
                            trafficModel: google.maps.TrafficModel.BEST_GUESS,
                        },
                    };
                    
                    try {
                        const response: any = await new Promise((resolve, reject) => {
                            directionsService.route(request, (res, status) => {
                                if (status === 'OK') resolve(res);
                                else reject(new Error(`Directions API failed for leave-by time: ${status}`));
                            });
                        });
                        
                        let totalDurationToFirstJobSeconds = 0;
                        response.routes[0].legs.forEach((leg: any) => {
                            totalDurationToFirstJobSeconds += (leg.duration_in_traffic || leg.duration).value;
                        });
                        
                        const supplierStops = stopsToFirstJob.slice(1, -1).filter(s => s.type === 'supplier').length;
                        totalDurationToFirstJobSeconds += supplierStops * 30 * 60; // Add 30 mins per supplier
                        
                        const scheduledTime = new Date(`${selectedDate}T${firstJobData.time}`);
                        const departureTime = new Date(scheduledTime.getTime() - totalDurationToFirstJobSeconds * 1000);
                        
                        finalLeaveByTime = departureTime;
                        if (isMounted) {
                            setLeaveByTime(formatTime(departureTime.toTimeString().slice(0, 5)));
                        }

                    } catch (error) {
                        console.error(error);
                        if(isMounted) {
                            addNotification("Could not calculate leave-by time.", 'error');
                            setLeaveByTime(null);
                        }
                    }
                }
            }

            // --- PART 2: OPTIMIZED "HAPPY PATH" - SINGLE API CALL FOR FULL ROUTE ---
            try {
                const origin = routeStops[0]?.data.address;
                const destination = routeStops[routeStops.length - 1]?.data.address;
                const waypoints = routeStops.slice(1, -1).map(stop => ({ location: stop.data.address, stopover: true }));

                const forwardRequest: any = {
                    origin,
                    destination,
                    waypoints,
                    travelMode: google.maps.TravelMode.DRIVING,
                };
                
                let currentTime = finalLeaveByTime || new Date(`${selectedDate}T08:00:00`);
                if (currentTime > new Date()) { // Only add departure time if it's in the future
                    forwardRequest.drivingOptions = {
                        departureTime: currentTime,
                        trafficModel: google.maps.TrafficModel.BEST_GUESS,
                    };
                }

                const response: any = await new Promise((resolve, reject) => {
                    directionsService.route(forwardRequest, (res, status) => {
                        if (status === 'OK') resolve(res);
                        else reject(new Error(`Full route request failed: ${status}`));
                    });
                });

                const newMetrics: Record<string, RouteMetrics> = {};
                let cumulativeDistance = 0;
                let cumulativeTime = 0;

                for (let i = 0; i < response.routes[0].legs.length; i++) {
                    const leg = response.routes[0].legs[i];
                    const destinationStop = routeStops[i + 1];
                    const travelDuration = leg.duration_in_traffic || leg.duration;
                    
                    cumulativeDistance += leg.distance.value;
                    cumulativeTime += travelDuration.value;

                    const arrivalAtDestination = new Date(currentTime.getTime() + travelDuration.value * 1000);
                    
                    let idleTime = 0;
                    let finalEta = arrivalAtDestination;
                    // FIX: Add type cast to `JobStopData` to resolve error when accessing `time` property on a union type.
                    const jobData = destinationStop.data as JobStopData;
                    if (destinationStop.type === 'job' && jobData.time) {
                        const scheduledTime = new Date(`${selectedDate}T${jobData.time}`);
                        if (arrivalAtDestination < scheduledTime) {
                            idleTime = Math.round((scheduledTime.getTime() - arrivalAtDestination.getTime()) / 60000);
                            finalEta = scheduledTime;
                        }
                    }
                    
                    newMetrics[destinationStop.id] = {
                        travelTimeText: travelDuration.text,
                        travelTimeValue: travelDuration.value,
                        travelDistanceText: leg.distance.text,
                        travelDistanceValue: leg.distance.value,
                        eta: formatTime(finalEta.toTimeString().slice(0, 5)),
                        idleTime
                    };

                    // Set departure time for the next leg
                    currentTime = finalEta;
                    if (destinationStop.type === 'job') {
                         const jobServiceDuration = (jobData.statusHistory?.find(h => h.timestamp.startsWith(selectedDate))?.duration) || 60;
                         currentTime = new Date(currentTime.getTime() + jobServiceDuration * 60000);
                    } else if (destinationStop.type === 'supplier') {
                        currentTime = new Date(currentTime.getTime() + 30 * 60000); // 30 min default for suppliers
                    }
                }
                 if (isMounted) {
                    setRouteMetrics(newMetrics);
                    setTotalMetrics({ distance: cumulativeDistance, time: cumulativeTime });
                }
                return; // IMPORTANT: Exit here if the happy path was successful

            } catch(error) {
                if(isMounted) {
                    console.warn("Optimized full-route calculation failed, falling back to leg-by-leg.", error);
                    addNotification("Couldn't get full route traffic data. Calculating leg-by-leg.", 'info');
                }
            }

            // --- PART 3: ROBUST FALLBACK - LEG-BY-LEG CALCULATION ---
            const fallbackMetrics: Record<string, RouteMetrics> = {};
            let currentTime = finalLeaveByTime || new Date(`${selectedDate}T08:00:00`);
            let cumulativeDistance = 0;
            let cumulativeTime = 0;

            for (let i = 0; i < routeStops.length - 1; i++) {
                const originStop = routeStops[i];
                const destinationStop = routeStops[i + 1];
                const request: any = {
                    origin: originStop.data.address,
                    destination: destinationStop.data.address,
                    travelMode: google.maps.TravelMode.DRIVING,
                };

                if (currentTime > new Date()) {
                    request.drivingOptions = {
                        departureTime: currentTime,
                        trafficModel: google.maps.TrafficModel.BEST_GUESS,
                    };
                }

                try {
                    const legResponse: any = await new Promise((resolve, reject) => {
                        directionsService.route(request, (res, status) => {
                            if (status === 'OK') resolve(res);
                            else reject(new Error(`Leg request failed: ${status}`));
                        });
                    });

                    const leg = legResponse.routes[0].legs[0];
                    const travelDuration = leg.duration_in_traffic || leg.duration;

                    cumulativeDistance += leg.distance.value;
                    cumulativeTime += travelDuration.value;

                    const arrivalAtDestination = new Date(currentTime.getTime() + travelDuration.value * 1000);
                    let idleTime = 0;
                    let finalEta = arrivalAtDestination;

                    const jobData = destinationStop.data as JobStopData;
                    if (destinationStop.type === 'job' && jobData.time) {
                        const scheduledTime = new Date(`${selectedDate}T${jobData.time}`);
                        if (arrivalAtDestination < scheduledTime) {
                            idleTime = Math.round((scheduledTime.getTime() - arrivalAtDestination.getTime()) / 60000);
                            finalEta = scheduledTime;
                        }
                    }

                    fallbackMetrics[destinationStop.id] = {
                        travelTimeText: travelDuration.text,
                        travelTimeValue: travelDuration.value,
                        travelDistanceText: leg.distance.text,
                        travelDistanceValue: leg.distance.value,
                        eta: formatTime(finalEta.toTimeString().slice(0, 5)),
                        idleTime
                    };
                    
                    currentTime = finalEta;
                     if (destinationStop.type === 'job') {
                         const jobServiceDuration = (jobData.statusHistory?.find(h => h.timestamp.startsWith(selectedDate))?.duration) || 60;
                         currentTime = new Date(currentTime.getTime() + jobServiceDuration * 60000);
                    } else if (destinationStop.type === 'supplier') {
                        currentTime = new Date(currentTime.getTime() + 30 * 60000);
                    }
                } catch (error) {
                    console.error(`Failed to calculate leg ${i}:`, error);
                    addNotification(`Could not calculate route from "${originStop.data.address}"`, 'error');
                    break; // Stop calculation on failure
                }
            }
            if(isMounted) {
                setRouteMetrics(fallbackMetrics);
                setTotalMetrics({ distance: cumulativeDistance, time: cumulativeTime });
            }
        };

        calculateAllMetrics();
    
        return () => { isMounted = false; };
    
    }, [mapLoaded, routeStops, selectedDate, addNotification]);

    return { routeMetrics, totalMetrics, leaveByTime };
};
