import { useMemo } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { RouteStop } from '../types.ts';
import { generateRouteStops } from '../utils.ts';

export const useRoutePlanner = (selectedDate: string): RouteStop[] => {
    const { contacts } = useContacts();
    const { mapSettings, businessInfo, routes } = useApp();

    return useMemo(() => {
        return generateRouteStops(selectedDate, contacts, mapSettings, businessInfo, routes);
    }, [selectedDate, contacts, mapSettings, businessInfo, routes]);
};
