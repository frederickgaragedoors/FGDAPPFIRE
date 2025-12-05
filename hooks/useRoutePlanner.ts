import { useMemo } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { RouteStop, JobStopData, JobStatus } from '../types.ts';
import { getLocalDateString, getAppointmentDetailsForDate } from '../utils.ts';

export const useRoutePlanner = (selectedDate: string): RouteStop[] => {
    const { contacts } = useContacts();
    const { mapSettings, businessInfo, routes } = useApp();

    const jobsForDate = useMemo(() => {
        const jobs: JobStopData[] = [];
        contacts.forEach(contact => {
            (contact.jobTickets || []).forEach(ticket => {
                const appointmentDetails = getAppointmentDetailsForDate(ticket, selectedDate);
                
                if (appointmentDetails) {
                    jobs.push({
                        ...ticket,
                        time: appointmentDetails.time,
                        contactName: contact.name,
                        contactAddress: contact.address,
                        contactId: contact.id,
                        address: ticket.jobLocation || contact.address,
                    });
                }
            });
        });
        return jobs.sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));
    }, [contacts, selectedDate]);

    const routeStops = useMemo<RouteStop[]>(() => {
        if (!mapSettings.homeAddress) return [];
        
        const savedRoute = routes[selectedDate];

        if (savedRoute) {
            const reconstructedRoute: RouteStop[] = [];
            savedRoute.forEach((stop, index) => {
                if (stop.type === 'home') {
                    reconstructedRoute.push({ type: 'home', id: `${stop.label}-${index}`, data: { address: mapSettings.homeAddress, label: stop.label } });
                } else if (stop.type === 'job') {
                    const contact = contacts.find(c => c.id === stop.contactId);
                    const ticket = contact?.jobTickets.find(t => t.id === stop.jobId.split('-')[0]);

                    if(ticket && contact) {
                        const appointmentDetails = getAppointmentDetailsForDate(ticket, selectedDate);

                        const jobData: JobStopData = {
                            ...ticket,
                            time: appointmentDetails?.time,
                            contactName: contact.name,
                            contactAddress: contact.address,
                            contactId: contact.id,
                            address: ticket.jobLocation || contact.address,
                        };
                         reconstructedRoute.push({ type: 'job', id: stop.jobId, data: jobData });
                    }
                } else if (stop.type === 'supplier') {
                    const supplierData = (businessInfo.suppliers || []).find(s => s.id === stop.supplierId);
                    if (supplierData) {
                        reconstructedRoute.push({ type: 'supplier', id: stop.id, data: supplierData });
                    }
                }
            });
            return reconstructedRoute;
        }

        const start: RouteStop = { type: 'home', id: 'start', data: { address: mapSettings.homeAddress, label: 'Start' } };
        const end: RouteStop = { type: 'home', id: 'end', data: { address: mapSettings.homeAddress, label: 'End' } };
        const jobStops: RouteStop[] = jobsForDate.map((job, index) => ({
            type: 'job',
            id: `${job.id}-${index}`,
            data: { ...job, address: job.jobLocation || job.contactAddress },
        }));

        return [start, ...jobStops, end];
    }, [jobsForDate, mapSettings.homeAddress, routes, selectedDate, businessInfo.suppliers, contacts]);

    return routeStops;
};
