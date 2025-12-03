import React, { useState, useMemo } from 'react';
import { useMileage } from '../contexts/MileageContext.tsx';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { Mileage } from '../types.ts';
import { CarIcon, PlusIcon, TrashIcon, EditIcon } from './icons.tsx';
import { generateId, getLocalDateString } from '../utils.ts';
import EmptyState from './EmptyState.tsx';
import AddTripModal from './AddTripModal.tsx';

const MileageView: React.FC = () => {
    const { mileageLogs, handleSaveMileageLog, handleDeleteMileageLog, importTripsForDate } = useMileage();
    const { contacts } = useContacts();
    const { mapSettings, businessInfo } = useApp();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMileage, setEditingMileage] = useState<Mileage | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));

    const handleImportTrips = async () => {
        setIsCalculating(true);
        await importTripsForDate(selectedDate, contacts);
        setIsCalculating(false);
    };

    const handleNewEntry = () => {
        setEditingMileage({
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            startAddress: mapSettings.homeAddress || '',
            endAddress: '',
            distance: 0,
            notes: '',
        });
        setIsModalOpen(true);
    };

    const handleEdit = (log: Mileage) => {
        setEditingMileage(log);
        setIsModalOpen(true);
    };

    const handleSave = (log: Mileage) => {
        handleSaveMileageLog(log);
        setIsModalOpen(false);
        setEditingMileage(null);
    };

    const handleDelete = (id: string) => {
        if(window.confirm("Are you sure you want to delete this trip?")) {
            handleDeleteMileageLog(id);
        }
    };

    const sortedLogs = useMemo(() => {
        return [...mileageLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [mileageLogs]);

    const summary = useMemo(() => {
        const totalDistance = sortedLogs.reduce((sum, log) => sum + log.distance, 0);
        const totalDeduction = totalDistance * (businessInfo.standardMileageRate || 0);
        return { totalDistance, totalDeduction };
    }, [sortedLogs, businessInfo.standardMileageRate]);

    return (
        <>
            <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mileage Tracker</h1>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Log business-related trips for expense reporting.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                            <button onClick={handleImportTrips} disabled={isCalculating} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50">
                                {isCalculating ? 'Importing...' : 'Import Trips'}
                            </button>
                            <button onClick={handleNewEntry} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                                <PlusIcon className="w-5 h-5" /> Log New Trip
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 flex-grow space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Trips</h3>
                            <p className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">{sortedLogs.length}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Distance</h3>
                            <p className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">{summary.totalDistance.toFixed(1)} mi</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Deduction</h3>
                            <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-500">${summary.totalDeduction.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 p-6">Logged Trips</h2>
                        {sortedLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Trip</th>
                                            <th className="px-6 py-3">Distance</th>
                                            <th className="px-6 py-3">Expense</th>
                                            <th className="px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {sortedLogs.map(log => (
                                            <tr key={log.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{new Date(log.date + 'T00:00:00').toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-100 max-w-xs truncate">
                                                    <span className="font-semibold">{log.notes || 'Business Trip'}</span>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{log.startAddress} &rarr; {log.endAddress}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">{log.distance} mi</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-500 font-semibold">
                                                    ${(log.distance * (businessInfo.standardMileageRate || 0)).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                    <button onClick={() => handleEdit(log)} className="p-2 text-slate-500 hover:text-sky-600"><EditIcon className="w-5 h-5"/></button>
                                                    <button onClick={() => handleDelete(log.id)} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8">
                                <EmptyState Icon={CarIcon} title="No Trips Logged" message="Click 'Log New Trip' to get started." />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <AddTripModal 
                    mileage={editingMileage}
                    onSave={handleSave}
                    onClose={() => { setIsModalOpen(false); setEditingMileage(null); }}
                />
            )}
        </>
    );
};

export default MileageView;
