import React from 'react';
import { RouteStop, RouteMetrics, HomeStopData, JobStopData, Supplier } from '../types.ts';
import { HomeIcon, UserCircleIcon, BuildingStorefrontIcon, MapPinIcon, PlusIcon, ClockIcon, TrashIcon, RefreshIcon } from './icons.tsx';
import { formatTime } from '../utils.ts';

interface RouteSidebarProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
    onResyncRoute: () => void;
    getToday: () => string;
    getTomorrow: () => string;
    routeStops: RouteStop[];
    routeMetrics: Record<string, RouteMetrics>;
    totalMetrics: { distance: number; time: number };
    leaveByTime: string | null;
    onAddStop: (index: number) => void;
    onDeleteStop: (id: string) => void;
    onViewJobDetail: (contactId: string, ticketId: string) => void;
}

const getStopName = (stop: RouteStop) => {
    // FIX: Add explicit type casts to resolve TypeScript errors when accessing properties on the 'StopData' union type.
    if (stop.type === 'home') return (stop.data as HomeStopData).label === 'Start' ? 'Start From Home' : 'Return Home';
    if (stop.type === 'job') return (stop.data as JobStopData).contactName;
    return (stop.data as Supplier).name;
};

const getStopIcon = (stop: RouteStop): { Icon: React.FC<any>, classes: string, bg: string } => {
    switch (stop.type) {
        case 'home': return { Icon: HomeIcon, classes: 'w-5 h-5 text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
        case 'job': return { Icon: UserCircleIcon, classes: 'w-5 h-5 text-sky-500 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' };
        case 'supplier': return { Icon: BuildingStorefrontIcon, classes: 'w-5 h-5 text-teal-500 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30' };
        default: return { Icon: MapPinIcon, classes: 'w-5 h-5 text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' };
    }
};

const RouteSidebar: React.FC<RouteSidebarProps> = ({
    selectedDate, onDateChange, onResyncRoute, getToday, getTomorrow,
    routeStops, routeMetrics, totalMetrics, leaveByTime,
    onAddStop, onDeleteStop, onViewJobDetail
}) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const isFutureDate = selectedDateObj >= today;

    const totalDriveLabel = isFutureDate ? "Drive (Traffic)" : "Total Drive";
    const travelTimeLabel = isFutureDate ? " (in traffic)" : "";

    return (
        <div className="contents md:flex md:w-1/3 lg:w-1/4 md:h-full md:flex-col md:border-r md:border-slate-200 md:dark:border-slate-700 md:bg-white md:dark:bg-slate-800">
            <div className="order-1 md:order-none bg-white dark:bg-slate-800">
                <div className="p-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
                    <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700"/>
                    <div className="flex items-center gap-1">
                        <button onClick={() => onDateChange(getToday())} className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">Today</button>
                        <button onClick={() => onDateChange(getTomorrow())} className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">Tomorrow</button>
                        <button onClick={onResyncRoute} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Re-sync jobs and re-optimize route"><RefreshIcon className="w-5 h-5"/></button>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="font-semibold">Route for {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}</h2>
                    <div className="flex justify-between items-center mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>Total: {(totalMetrics.distance * 0.000621371).toFixed(1)} mi</span>
                        <span>{totalDriveLabel}: {Math.round(totalMetrics.time / 60)} min</span>
                    </div>
                    {leaveByTime && (
                        <div className="mt-3 p-2 text-center bg-sky-50 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-800 rounded-md">
                        <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                                Leave home by <span className="text-lg">{leaveByTime}</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <ul className="order-3 md:order-none md:flex-grow md:overflow-y-auto p-4 bg-white dark:bg-slate-800">
                {routeStops.map((stop, index) => {
                    const metrics = routeMetrics[stop.id];
                    const { Icon, classes, bg } = getStopIcon(stop);
                    
                    return (
                        <React.Fragment key={stop.id}>
                            {index > 0 && (
                                <li className="pl-4 h-10 flex items-center relative">
                                    <div className="w-10 flex-shrink-0 flex justify-center h-full">
                                        <div className="w-px h-full bg-slate-200 dark:bg-slate-600 border-l border-dashed border-slate-300 dark:border-slate-500"></div>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                        {metrics && (
                                            <div className="flex items-center gap-2">
                                                <span>{metrics.travelTimeText}{travelTimeLabel} • {metrics.travelDistanceText}</span>
                                            </div>
                                        )}
                                        {metrics && metrics.idleTime > 0 && index !== 1 && (
                                             <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                <ClockIcon className="w-3 h-3" />
                                                <span className="font-semibold">Idle time: {metrics.idleTime} min</span>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => onAddStop(index)} 
                                        className="absolute top-1/2 left-2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center text-slate-400 hover:bg-sky-500 hover:text-white hover:border-sky-500 transition-all" title="Add stop">
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            )}
                            <li>
                                <div 
                                    // FIX: Add explicit type casts to resolve TypeScript errors when accessing properties on the 'StopData' union type.
                                    onClick={stop.type === 'job' ? () => onViewJobDetail((stop.data as JobStopData).contactId, (stop.data as JobStopData).id.split('-')[0]) : undefined}
                                    className={`p-3 rounded-lg flex items-start space-x-3 ${stop.type === 'job' ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors' : ''}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                                        <Icon className={classes} />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                         <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{getStopName(stop)}</p>
                                         <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stop.data.address}</p>

                                        <div className="flex items-center flex-wrap gap-2 mt-1">
                                            {/* FIX: Add explicit type casts to resolve TypeScript errors when accessing properties on the 'StopData' union type. */}
                                            {stop.type === 'job' && (stop.data as JobStopData).time && (
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">Apt: {formatTime((stop.data as JobStopData).time)}</p>
                                            )}
                                            {metrics && (
                                                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/50 px-2 py-0.5 rounded-full">ETA: {metrics.eta}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-10 flex-shrink-0 flex flex-col items-center justify-center space-y-2">
                                        {/* FIX: Add explicit type casts to resolve TypeScript errors when accessing properties on the 'StopData' union type. */}
                                        {(stop.type !== 'home' || (stop.data as HomeStopData).label === 'End') && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.data.address)}`, '_blank');
                                                }}
                                                className="p-1.5 rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-800/50"
                                                title="Navigate"
                                            >
                                                <MapPinIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {stop.type === 'supplier' && (
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteStop(stop.id); }} className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-800/50" title="Delete Stop">
                                                <TrashIcon className="w-5 h-5"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        </React.Fragment>
                    );
                })}
            </ul>
        </div>
    );
};

export default RouteSidebar;
