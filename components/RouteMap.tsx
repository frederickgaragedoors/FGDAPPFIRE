import React, { useRef, useEffect } from 'react';
import { RouteStop, HomeStopData, JobStopData, Supplier, PlaceStopData } from '../types.ts';
import { useApp } from '../contexts/AppContext.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';

declare const google: any;

interface RouteMapProps {
    routeStops: RouteStop[];
}

const getStopName = (stop: RouteStop) => {
    // FIX: Add explicit type casts to resolve TypeScript errors when accessing properties on the 'StopData' union type.
    if (stop.type === 'home') return (stop.data as HomeStopData).label === 'Start' ? 'Start From Home' : 'Return Home';
    if (stop.type === 'job') return (stop.data as JobStopData).contactName;
    if (stop.type === 'place') return (stop.data as PlaceStopData).name;
    return (stop.data as Supplier).name;
};

const RouteMap: React.FC<RouteMapProps> = ({ routeStops }) => {
    const { mapSettings } = useApp();
    const { isLoaded: mapLoaded } = useGoogleMaps(mapSettings.apiKey);
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const polylinesRef = useRef<any[]>([]);
    const markersRef = useRef<any[]>([]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || googleMapRef.current) return;
        googleMapRef.current = new google.maps.Map(mapRef.current, { center: { lat: 34.0522, lng: -118.2437 }, zoom: 8, disableDefaultUI: true, zoomControl: true });
    }, [mapLoaded]);

    useEffect(() => {
        if (!mapLoaded || !googleMapRef.current) return;

        // Cleanup function to remove old elements from the map
        const cleanupMap = () => {
            polylinesRef.current.forEach(p => p.setMap(null));
            polylinesRef.current = [];
            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current = [];
        };

        if (routeStops.length < 2) {
            cleanupMap();
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        const directionsService = new google.maps.DirectionsService();
        const colors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043', '#5C6BC0'];
        let colorIndex = 0;

        for (let i = 0; i < routeStops.length - 1; i++) {
            directionsService.route({
                origin: routeStops[i].data.address,
                destination: routeStops[i + 1].data.address,
                travelMode: google.maps.TravelMode.DRIVING
            }, (response: any, status: any) => {
                if (status === 'OK') {
                    const poly = new google.maps.Polyline({
                        path: response.routes[0].overview_path,
                        strokeColor: colors[colorIndex++ % colors.length],
                        strokeOpacity: 0.8,
                        strokeWeight: 6,
                        map: googleMapRef.current
                    });
                    polylinesRef.current.push(poly);
                    response.routes[0].overview_path.forEach((pt: any) => bounds.extend(pt));
                    if (googleMapRef.current) googleMapRef.current.fitBounds(bounds);
                }
            });
        }

        routeStops.forEach((stop, index) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: stop.data.address }, (results: any, status: any) => {
                if (status === 'OK') {
                    const marker = new google.maps.Marker({
                        position: results[0].geometry.location,
                        map: googleMapRef.current,
                        label: { text: (index + 1).toString(), color: 'white', fontWeight: 'bold' },
                        title: getStopName(stop)
                    });
                    markersRef.current.push(marker);
                    bounds.extend(results[0].geometry.location);
                    if (googleMapRef.current) googleMapRef.current.fitBounds(bounds);
                }
            });
        });

        return cleanupMap;
    }, [mapLoaded, routeStops]);

    return (
        <div ref={mapRef} className="w-full h-full bg-slate-200 dark:bg-slate-700">
            {!mapLoaded && <div className="flex items-center justify-center h-full text-slate-500">Loading Map...</div>}
        </div>
    );
};

export default RouteMap;