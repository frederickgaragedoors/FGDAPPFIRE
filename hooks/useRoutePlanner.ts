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
                // Determine the correct appointment time by finding the most recent "scheduling" status on the selected day.
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

                // Now, separately, determine if the job is active on the selected day using its overall latest status.
                const sortedHistory = (ticket.statusHistory && ticket.statusHistory.length > 0)
                    ? [...ticket.statusHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    : [];
                
                if (sortedHistory.length === 0) return;
                const latestStatusEntry = sortedHistory[0];
                
                if (routableStatuses.includes(latestStatusEntry.status)) {
                    if (getLocalDateString(new Date(latestStatusEntry.timestamp)) === selectedDate) {
                        if (!jobs.has(ticket.id)) {
                            jobs.set(ticket.id, {
                                ...ticket,
                                time: appointmentTime, // Use the dynamically determined appointment time for routing.
                                contactName: contact.name,
                                contactAddress: contact.address,
                                contactId: contact.id,
                                address: ticket.jobLocation || contact.address,
                            });
                        }
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
                    // When finding the job data, strip any unique identifier added for return trips
                    const originalJobId = stop.jobId.split('-')[0];
                    const jobData = jobsForDate.find(j => j.id === originalJobId);
                    if (jobData) {
                        // Use the stop's unique ID for the key, but the found data
                        reconstructedRoute.push({ type: 'job', id: stop.jobId, data: { ...jobData, address: jobData.jobLocation || jobData.contactAddress } });
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
    }, [jobsForDate, mapSettings.homeAddress, routes, selectedDate, businessInfo.suppliers]);

    return routeStops;
};