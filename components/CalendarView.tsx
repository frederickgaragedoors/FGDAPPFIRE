
import React, { useState, useMemo } from 'react';
import { Contact, JobTicket, jobStatusColors, paymentStatusColors, paymentStatusLabels } from '../types.ts';
import { ChevronLeftIcon, ChevronRightIcon, BriefcaseIcon, PlusIcon, CalendarIcon } from './icons.tsx';
import { formatTime } from '../utils.ts';
import EmptyState from './EmptyState.tsx';

interface CalendarViewProps {
    contacts: Contact[];
    onViewJob: (contactId: string, ticketId: string) => void;
    onAddJob: (date: Date) => void;
}

type JobEvent = JobTicket & {
    contactId: string;
    contactName: string;
};

const CalendarView: React.FC<CalendarViewProps> = ({ contacts, onViewJob, onAddJob }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const allJobs = useMemo<JobEvent[]>(() => {
        return contacts.flatMap(contact => 
            (contact.jobTickets || []).map(ticket => ({
                ...ticket,
                contactId: contact.id,
                contactName: contact.name
            }))
        );
    }, [contacts]);

    // Optimization: Create a map of date string -> jobs to avoid filtering arrays for every calendar cell
    const jobsByDate = useMemo(() => {
        const map: Record<string, JobEvent[]> = {};
        allJobs.forEach(job => {
            if (job.date) {
                if (!map[job.date]) {
                    map[job.date] = [];
                }
                map[job.date].push(job);
            }
        });
        return map;
    }, [allJobs]);

    // Helpers for calendar logic
    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const startingDay = getFirstDayOfMonth(year, month);

    const calendarDays = useMemo(() => {
        const days = [];
        // Add padding for previous month
        for (let i = 0; i < startingDay; i++) {
            days.push(null);
        }
        // Add actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    }, [year, month, startingDay, daysInMonth]);
    
    // Calculate number of weeks
    const weeksCount = Math.ceil(calendarDays.length / 7);

    // Safe local date string generation "YYYY-MM-DD"
    const getLocalDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const selectedDateString = getLocalDateString(selectedDate);
    const selectedDateJobs = jobsByDate[selectedDateString] || [];

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const [y, m, d] = e.target.value.split('-').map(Number);
            // Note: Month in Date constructor is 0-indexed. Input gives 1-indexed month.
            const newDate = new Date(y, m - 1, d);
            setCurrentDate(newDate);
            setSelectedDate(newDate);
            // Reset value so selecting the same date again triggers change if needed
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
                        <button 
                            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600" 
                            title="Jump to date"
                        >
                            <CalendarIcon className="w-5 h-5" />
                        </button>
                        <input
                            type="date"
                            onChange={handleJumpToDate}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            aria-label="Jump to specific date"
                        />
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

            <div className="flex flex-col md:flex-row">
                {/* Calendar Grid Container */}
                <div className="flex flex-col w-full md:w-2/3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
                        {weekDays.map(day => (
                            <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* Days Grid */}
                    <div 
                        className="grid grid-cols-7 bg-slate-200 dark:bg-slate-700 gap-px border-b border-slate-200 dark:border-slate-700"
                        style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(80px, 1fr))` }}
                    >
                        {calendarDays.map((day, index) => {
                             if (!day) return <div key={`empty-${index}`} className="bg-white dark:bg-slate-800 min-h-[80px]"></div>;
                             
                             const dateString = getLocalDateString(day);
                             const jobs = jobsByDate[dateString] || [];
                             const isSelected = day.toDateString() === selectedDate.toDateString();
                             const isToday = day.toDateString() === new Date().toDateString();

                             return (
                                <div 
                                    key={dateString} 
                                    onClick={() => setSelectedDate(day)}
                                    className={`bg-white dark:bg-slate-800 p-1 sm:p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex flex-col min-h-[80px] ${isSelected ? 'ring-2 ring-inset ring-sky-500 z-0' : ''}`}
                                >
                                    <div className="flex justify-between items-start flex-shrink-0">
                                        <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-sky-500 text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {day.getDate()}
                                        </span>
                                        {jobs.length > 0 && (
                                            <span className="text-xs font-bold text-slate-400 md:hidden">{jobs.length}</span>
                                        )}
                                    </div>
                                    
                                    <div className="mt-1 space-y-1 flex-grow relative">
                                        {/* Mobile: Just dots */}
                                        <div className="flex flex-wrap gap-1 md:hidden justify-center mt-1">
                                            {jobs.slice(0, 4).map(job => (
                                                <div key={job.id} className={`w-1.5 h-1.5 rounded-full ${jobStatusColors[job.status].base.split(' ')[0].replace('bg-', 'bg-').replace('100', '400')}`}></div>
                                            ))}
                                             {jobs.length > 4 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                                        </div>

                                        {/* Desktop: Bars */}
                                        <div className="hidden md:flex flex-col gap-1">
                                            {jobs.slice(0, 4).map(job => (
                                                <div key={job.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border border-opacity-10 ${jobStatusColors[job.status].base} ${jobStatusColors[job.status].text}`}>
                                                     <span className="font-semibold mr-1">{job.time || ''}</span>
                                                     {job.contactName}
                                                </div>
                                            ))}
                                            {jobs.length > 4 && (
                                                <span className="text-xs text-slate-400 pl-1">+{jobs.length - 4} more</span>
                                            )}
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
                        <button 
                            onClick={() => onAddJob(selectedDate)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"
                        >
                            <PlusIcon className="w-3 h-3" />
                            <span>Add Job</span>
                        </button>
                    </div>
                    <div className="p-4">
                        {selectedDateJobs.length > 0 ? (
                            <ul className="space-y-3">
                                {selectedDateJobs.sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00')).map(job => {
                                     const paymentStatus = job.paymentStatus || 'unpaid';
                                     const paymentStatusColor = paymentStatusColors[paymentStatus];
                                     const paymentStatusLabel = paymentStatusLabels[paymentStatus];

                                     return (
                                        <li 
                                            key={job.id} 
                                            onClick={() => onViewJob(job.contactId, job.id)}
                                            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${jobStatusColors[job.status].base} ${jobStatusColors[job.status].text}`}>
                                                        {job.status}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${paymentStatusColor.base} ${paymentStatusColor.text}`}>
                                                        {paymentStatusLabel}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap ml-2">
                                                    {job.time ? formatTime(job.time) : 'No Time'}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 mt-1">{job.contactName}</p>
                                            {job.notes && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">{job.notes}</p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="py-8">
                                <EmptyState 
                                    Icon={BriefcaseIcon}
                                    title="No Jobs"
                                    message="No jobs scheduled for this day."
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;