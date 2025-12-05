import React, { useState, useMemo } from 'react';
import { JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels, JobStatus, PaymentStatus, StatusHistoryEntry } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { ChevronLeftIcon, ChevronRightIcon, BriefcaseIcon, PlusIcon, CalendarIcon } from './icons.tsx';
import { formatTime, getLocalDateString } from '../utils.ts';
import EmptyState from './EmptyState.tsx';

interface CalendarViewProps {
    onViewJob: (contactId: string, ticketId: string) => void;
    onAddJob: (date: Date) => void;
}

// New type for a calendar event, based on a status history entry
type CalendarEvent = JobTicket & {
    contactId: string;
    contactName: string;
    // Unique ID for the event, combining ticket and history entry IDs
    eventId: string; 
    // Overriding JobTicket fields with StatusHistoryEntry fields for this specific event
    status: JobStatus;
    date: string; // The date for the calendar (YYYY-MM-DD)
    time?: string;
    notes: string; // Notes from status history, falling back to job notes
};

const CalendarView: React.FC<CalendarViewProps> = ({ onViewJob, onAddJob }) => {
    const { contacts } = useContacts();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const allEvents = useMemo<CalendarEvent[]>(() => {
        return (contacts || []).flatMap(contact => 
            (contact.jobTickets || []).flatMap(ticket => {
                // FIX: This commit resolves TypeScript errors by refactoring the component to be fully compatible with the `statusHistory`-based data model. It removes dependencies on deprecated `status` and `date` properties by creating a robust fallback mechanism for older `JobTicket` data. The logic for determining an event's effective time has also been improved to prevent reliance on the non-existent `ticket.time` property, ensuring data consistency and eliminating type errors.
                const history = ticket.statusHistory && ticket.statusHistory.length > 0
                    ? ticket.statusHistory
                    : (ticket.createdAt ? [{ 
                        id: 'fallback', 
                        status: 'Job Created' as JobStatus, 
                        timestamp: ticket.createdAt, 
                        notes: ticket.notes 
                    }] as StatusHistoryEntry[] : []);

                return history
                    .filter(historyEntry => 
                        historyEntry.status === 'Scheduled' || 
                        historyEntry.status === 'Estimate Scheduled'
                    )
                    .map(historyEntry => {
                    const timestamp = historyEntry.timestamp;
                    const hasTime = timestamp.includes('T');
                    
                    const displayDate = new Date(timestamp);

                    let effectiveTime: string | undefined;
                    if (hasTime) {
                        const hours = String(displayDate.getHours()).padStart(2, '0');
                        const minutes = String(displayDate.getMinutes()).padStart(2, '0');
                        effectiveTime = `${hours}:${minutes}`;
                    }
                    
                    const localDateString = getLocalDateString(displayDate);

                    return {
                        ...ticket, // Spread original ticket for properties like paymentStatus
                        contactId: contact.id,
                        contactName: contact.name,
                        eventId: `${ticket.id}-${historyEntry.id}`, // Create a unique ID for the event
                        status: historyEntry.status,
                        date: localDateString, 
                        time: effectiveTime,
                        notes: historyEntry.notes || ticket.notes, // Prefer status-specific notes
                    };
                });
            })
        );
    }, [contacts]);


    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        allEvents.forEach(event => {
            if (event.date) {
                if (!map[event.date]) {
                    map[event.date] = [];
                }
                map[event.date].push(event);
            }
        });
        return map;
    }, [allEvents]);

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const startingDay = getFirstDayOfMonth(year, month);

    const calendarDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < startingDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    }, [year, month, startingDay, daysInMonth]);
    
    const weeksCount = Math.ceil(calendarDays.length / 7);

    const selectedDateString = getLocalDateString(selectedDate);
    const selectedDateEvents = eventsByDate[selectedDateString] || [];

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const [y, m, d] = e.target.value.split('-').map(Number);
            const newDate = new Date(y, m - 1, d);
            setCurrentDate(newDate);
            setSelectedDate(newDate);
            e.target.value = '';
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                     <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <button className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600" title="Jump to date">
                            <CalendarIcon className="w-5 h-5" />
                        </button>
                        <input type="date" onChange={handleJumpToDate} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" aria-label="Jump to specific date" />
                    </div>
                    <button onClick={handleToday} className="px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600">Today</button>
                    <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row flex-grow">
                {/* Calendar Grid Container */}
                <div className="flex flex-col w-full md:w-2/3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
                        {weekDays.map(day => (
                            <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{day}</div>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-7 bg-slate-200 dark:bg-slate-700 gap-px border-b border-slate-200 dark:border-slate-700 flex-grow" style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(80px, 1fr))` }}>
                        {calendarDays.map((day, index) => {
                             if (!day) return <div key={`empty-${index}`} className="bg-white dark:bg-slate-800 min-h-[80px]"></div>;
                             
                             const dateString = getLocalDateString(day);
                             const events = eventsByDate[dateString] || [];
                             const isSelected = day.toDateString() === selectedDate.toDateString();
                             const isToday = day.toDateString() === new Date().toDateString();

                             return (
                                <div key={dateString} onClick={() => setSelectedDate(day)} className={`bg-white dark:bg-slate-800 p-1 sm:p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex flex-col min-h-[80px] ${isSelected ? 'ring-2 ring-inset ring-sky-500 z-0' : ''}`}>
                                    <div className="flex justify-between items-start flex-shrink-0">
                                        <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-sky-500 text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {day.getDate()}
                                        </span>
                                        {events.length > 0 && <span className="text-xs font-bold text-slate-400 md:hidden">{events.length}</span>}
                                    </div>
                                    
                                    <div className="mt-1 space-y-1 flex-grow relative">
                                        <div className="flex flex-wrap gap-1 md:hidden justify-center mt-1">
                                            {events.slice(0, 4).map(event => {
                                                const statusStyle = jobStatusColors[event.status] || jobStatusColors['Scheduled'];
                                                return <div key={event.eventId} className={`w-1.5 h-1.5 rounded-full ${statusStyle.base.split(' ')[0].replace('bg-', 'bg-').replace('100', '400')}`}></div>
                                            })}
                                             {events.length > 4 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                                        </div>
                                        <div className="hidden md:flex flex-col gap-1">
                                            {events.slice(0, 4).map(event => {
                                                const statusStyle = jobStatusColors[event.status] || jobStatusColors['Scheduled'];
                                                return (
                                                    <div key={event.eventId} className={`text-[10px] px-1.5 py-0.5 rounded truncate border border-opacity-10 ${statusStyle.base} ${statusStyle.text}`}>
                                                         <span className="font-semibold mr-1">{event.time ? formatTime(event.time) : ''}</span>
                                                         {event.contactName}
                                                    </div>
                                                );
                                            })}
                                            {events.length > 4 && <span className="text-xs text-slate-400 pl-1">+{events.length - 4} more</span>}
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                </div>

                {/* Agenda View */}
                <div className="w-full md:w-1/3 flex flex-col bg-white dark:bg-slate-800 border-t md:border-t-0 border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                            {selectedDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </h3>
                        <button onClick={() => onAddJob(selectedDate)} className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">
                            <PlusIcon className="w-3 h-3" />
                            <span>Add Job</span>
                        </button>
                    </div>
                    <div className="p-4 flex-grow overflow-y-auto">
                        {selectedDateEvents.length > 0 ? (
                            <ul className="space-y-3">
                                {selectedDateEvents.sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00')).map(event => {
                                     const paymentStatus = event.paymentStatus || 'unpaid';
                                     const paymentStatusColor = paymentStatusColors[paymentStatus];
                                     const paymentStatusLabel = paymentStatusLabels[paymentStatus];
                                     const statusStyle = jobStatusColors[event.status] || jobStatusColors['Scheduled'];

                                     return (
                                        <li key={event.eventId} onClick={() => onViewJob(event.contactId, event.id)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer transition-all">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${statusStyle.base} ${statusStyle.text}`}>{event.status}</span>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${paymentStatusColor.base} ${paymentStatusColor.text}`}>{paymentStatusLabel}</span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap ml-2">{event.time ? formatTime(event.time) : 'No Time'}</span>
                                            </div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 mt-1">{event.contactName}</p>
                                            {event.notes && <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">{event.notes}</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="py-8">
                                <EmptyState Icon={BriefcaseIcon} title="No Events" message="No jobs or events scheduled for this day." />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;