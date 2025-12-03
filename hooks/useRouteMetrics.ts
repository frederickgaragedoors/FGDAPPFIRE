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
            // FIX: Always reset state on re-calculation to prevent stale data
            if (isMounted) {
                setRouteMetrics({});
                setTotalMetrics({ distance: 0, time: 0 });
                setLeaveByTime(null);
            }

            if (!isMounted || !mapLoaded || routeStops.length < 2) {
                return; // Exit if not ready or no route to calculate
            }

            const directionsService = new google.maps.DirectionsService();
            let finalLeaveByTime: Date | null = null;

            // --- PART 1: CALCULATE LEAVE-BY TIME (Replaces the flawed backward pass) ---
            const firstJobIndex = routeStops.findIndex(s => s.type === 'job');
            if (firstJobIndex > 0) {
                const firstJob = routeStops[firstJobIndex];
                if (firstJob.type === 'job' && firstJob.data.time) {
                    
                    // FIX: Calculate total duration including any intermediate supplier stops
                    const stopsToFirstJob = routeStops.slice(0, firstJobIndex + 1);
                    const origin = stopsToFirstJob[0].data.address;
                    const destination = stopsToFirstJob[stopsToFirstJob.length - 1].data.address;
                    const waypoints = stopsToFirstJob.slice(1, -1).map(stop => ({
                        location: stop.data.address,
                        stopover: true,
                    }));

                    const request = {
                        origin,
                        destination,
                        waypoints,
                        travelMode: google.maps.TravelMode.DRIVING,
                        drivingOptions: {
                            departureTime: new Date(),
                            trafficModel: google.maps.TrafficModel.BEST_GUESS,
                        },
                    };
                    
                    try {
                        const response: any = await new Promise((resolve, reject) => {
                            directionsService.route(request, (res: any, status: any) => {
                                if (status === 'OK') resolve(res);
                                else reject(new Error(`Directions request failed for leave-by time calculation: ${status}`));
                            });
                        });
                        
                        let totalTravelDurationSeconds = 0;
                        response.routes[0].legs.forEach((leg: any) => {
                            totalTravelDurationSeconds += (leg.duration_in_traffic || leg.duration).value;
                        });

                        const intermediateSupplierStops = stopsToFirstJob.slice(1, -1).filter(s => s.type === 'supplier').length;
                        const supplierServiceTimeSeconds = intermediateSupplierStops * 30 * 60; // 30 mins per supplier
                        
                        const totalDurationToFirstJobSeconds = totalTravelDurationSeconds + supplierServiceTimeSeconds;
                        
                        const scheduledTime = new Date(`${selectedDate}T${firstJob.data.time}`);
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


            // --- PART 2: FORWARD PASS for all ETAs (using a single API call) ---
            const newMetrics: Record<string, RouteMetrics> = {};
            
            const origin = routeStops[0]?.data.address;
            const destination = routeStops[routeStops.length - 1]?.data.address;
            const waypoints = routeStops.slice(1, -1).map(stop => ({
                location: stop.data.address,
                stopover: true,
            }));

            const forwardRequest: any = {
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false, // Keep the user's order
            };
            
            // Use calculated leave by time, or default to 8 AM
            let currentTime = finalLeaveByTime || new Date(`${selectedDate}T08:00:00`);

            if (currentTime > new Date()) {
                forwardRequest.drivingOptions = {
                    departureTime: currentTime,
                    trafficModel: google.maps.TrafficModel.BEST_GUESS,
                };
            }

            try {
                const response: any = await new Promise((resolve, reject) => {
                    directionsService.route(forwardRequest, (res: any, status: any) => {
                        if (status === 'OK') resolve(res);
                        else reject(new Error(`Directions request failed on forward pass: ${status}`));
                    });
                });

                const { legs } = response.routes[0];
                let cumulativeDistance = 0;
                let cumulativeTime = 0;

                for (let i = 0; i < legs.length; i++) {
                    const leg = legs[i];
                    const destinationStop = routeStops[i + 1];

                    const travelDuration = leg.duration_in_traffic || leg.duration;
                    
                    cumulativeDistance += leg.distance.value;
                    cumulativeTime += travelDuration.value;

                    const arrivalAtDestination = new Date(currentTime.getTime() + travelDuration.value * 1000);
                    
                    let idleTime = 0;
                    let finalEta = arrivalAtDestination;
                    if (destinationStop.type === 'job' && destinationStop.data.time) {
                        const [h, m] = destinationStop.data.time.split(':').map(Number);
                        const scheduledTime = new Date(arrivalAtDestination);
                        scheduledTime.setHours(h, m, 0, 0);

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

                    // Set departure time for the *next* leg
                    currentTime = finalEta;
                    if (destinationStop.type === 'job') {
                        // Find the most recent status history entry to prioritize its duration
                        const jobData = destinationStop.data as JobStopData;
                        const sortedHistory = jobData.statusHistory && jobData.statusHistory.length > 0
                            ? [...jobData.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            : [];
                        
                        const mostRecentStatusEntry = sortedHistory[0];

                        let serviceDurationInMinutes: number;

                        if (mostRecentStatusEntry && typeof mostRecentStatusEntry.duration === 'number') {
                            serviceDurationInMinutes = mostRecentStatusEntry.duration;
                        } else {
                            serviceDurationInMinutes = 60;
                        }
                        
                        currentTime = new Date(currentTime.getTime() + serviceDurationInMinutes * 60000);
                    } else if (destinationStop.type === 'supplier') {
                        currentTime = new Date(currentTime.getTime() + 30 * 60000); // 30 min default for suppliers
                    }
                }
                 if (isMounted) {
                    setRouteMetrics(newMetrics);
                    setTotalMetrics({ distance: cumulativeDistance, time: cumulativeTime });
                }

            } catch(error) {
                if(isMounted) {
                    console.error("Failed to calculate route metrics:", error);
                    addNotification("Could not get traffic data for the full route. Check addresses.", 'error');
                    setRouteMetrics({});
                    setTotalMetrics({ distance: 0, time: 0 });
                }
            }
        };

        calculateAllMetrics();
    
        return () => { isMounted = false; };
    
    }, [mapLoaded, routeStops, selectedDate, addNotification]);

    return { routeMetrics, totalMetrics, leaveByTime };
};