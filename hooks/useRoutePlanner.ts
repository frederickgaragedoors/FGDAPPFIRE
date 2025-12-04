import { useMemo } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { RouteStop, JobStopData, JobStatus } from '../types.ts';
import { getLocalDateString } from '../utils.ts';

const routableStatuses: JobStatus[] = ['Scheduled', 'Estimate Scheduled', 'In Progress', 'Supplier Run'];

export const useRoutePlanner = (selectedDate: string): RouteStop[] => {
    const { contacts } = useContacts();
    const { mapSettings, businessInfo, routes } = useApp();

    const jobsForDate = useMemo(() => {
        const jobs = new Map<string, JobStopData>();
        contacts.forEach(contact => {
            (contact.jobTickets || []).forEach(ticket => {
                // FIX: Check if the ticket was *ever* routable on the selected date, not just its current status.
                const wasRoutableOnDate = (ticket.statusHistory || []).some(entry => 
                    routableStatuses.includes(entry.status) &&
                    getLocalDateString(new Date(entry.timestamp)) === selectedDate
                );

                if (wasRoutableOnDate) {
                    // If it was, find its primary appointment time for sorting purposes.
                    const relevantHistory = (ticket.statusHistory || [])
                        .filter(h => getLocalDateString(new Date(h.timestamp)) === selectedDate && (h.status === 'Scheduled' || h.status === 'Estimate Scheduled'))
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                    const appointmentEntry = relevantHistory[0];
                    let appointmentTime: string | undefined;

                    if (appointmentEntry && appointmentEntry.timestamp.includes('T')) {
                        const d = new Date(appointmentEntry.timestamp);
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        appointmentTime = `${hours}:${minutes}`;
                    }

                    // Add the job to the list for this day.
                    if (!jobs.has(ticket.id)) {
                        jobs.set(ticket.id, {
                            ...ticket,
                            time: appointmentTime,
                            contactName: contact.name,
                            contactAddress: contact.address,
                            contactId: contact.id,
                            address: ticket.jobLocation || contact.address,
                        });
                    }
                }
            });
        });
        return Array.from(jobs.values()).sort((a, b) => (a.time || "23:59").localeCompare(b.time || "23:59"));
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
                         const relevantHistory = (ticket.statusHistory || [])
                            .filter(h => getLocalDateString(new Date(h.timestamp)) === selectedDate && (h.status === 'Scheduled' || h.status === 'Estimate Scheduled'))
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                        const appointmentEntry = relevantHistory[0];
                        let appointmentTime: string | undefined;

                        if (appointmentEntry && appointmentEntry.timestamp.includes('T')) {
                            const d = new Date(appointmentEntry.timestamp);
                            appointmentTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                        }

                        const jobData: JobStopData = {
                            ...ticket,
                            time: appointmentTime,
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
