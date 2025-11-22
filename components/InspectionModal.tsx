
import React, { useState, useEffect } from 'react';
import { XIcon } from './icons.tsx';
import { InspectionItem, DEFAULT_INSPECTION_ITEMS, InspectionStatus } from '../types.ts';
import { generateId } from '../utils.ts';

interface InspectionModalProps {
    existingInspection?: InspectionItem[];
    onSave: (inspection: InspectionItem[]) => void;
    onClose: () => void;
}

const InspectionModal: React.FC<InspectionModalProps> = ({ existingInspection, onSave, onClose }) => {
    const [items, setItems] = useState<InspectionItem[]>([]);

    useEffect(() => {
        if (existingInspection && existingInspection.length > 0) {
            // Merge existing checks with potentially new default items if the default list has expanded
            const merged = DEFAULT_INSPECTION_ITEMS.map(defaultName => {
                const existing = existingInspection.find(i => i.name === defaultName);
                if (existing) return existing;
                return { id: generateId(), name: defaultName, status: 'N/A' as InspectionStatus };
            });
            
            // Also keep items that might have been renamed or custom added in legacy data (though we don't have custom adding yet)
            const extraItems = existingInspection.filter(i => !DEFAULT_INSPECTION_ITEMS.includes(i.name));
            
            setItems([...merged, ...extraItems]);
        } else {
            // Initialize fresh
            const newItems = DEFAULT_INSPECTION_ITEMS.map(name => ({
                id: generateId(),
                name: name,
                status: 'N/A' as InspectionStatus,
                notes: ''
            }));
            setItems(newItems);
        }
    }, [existingInspection]);

    const handleStatusChange = (id: string, status: InspectionStatus) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    };

    const handleMarkAllPass = () => {
        setItems(prev => prev.map(item => ({ ...item, status: 'Pass' })));
    };

    const handleSave = () => {
        onSave(items);
    };

    const getStatusColor = (status: InspectionStatus) => {
        switch (status) {
            case 'Pass': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'Fail': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'Repaired': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div>
                         <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">25-Point Safety Inspection</h2>
                         <p className="text-sm text-slate-500 dark:text-slate-400">Document the condition of the garage door system.</p>
                    </div>
                   
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-end">
                     <button 
                        onClick={handleMarkAllPass}
                        className="text-sm text-sky-600 dark:text-sky-400 font-medium hover:text-sky-700 dark:hover:text-sky-300 px-3 py-1 rounded hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
                    >
                        Mark All as Pass
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-4">
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${getStatusColor(item.status || 'N/A')}`}>
                                <div className="mb-2 sm:mb-0 sm:mr-4 flex-grow">
                                    <span className="font-medium text-sm sm:text-base block">
                                        <span className="opacity-60 mr-2">{index + 1}.</span>
                                        {item.name}
                                    </span>
                                </div>
                                <div className="flex bg-white dark:bg-slate-800 rounded-md shadow-sm p-1 w-full sm:w-auto">
                                    {(['Pass', 'Fail', 'Repaired', 'N/A'] as InspectionStatus[]).map((option) => {
                                         const isActive = item.status === option;
                                         let activeClass = '';
                                         if (isActive) {
                                             if (option === 'Pass') activeClass = 'bg-green-500 text-white';
                                             else if (option === 'Fail') activeClass = 'bg-red-500 text-white';
                                             else if (option === 'Repaired') activeClass = 'bg-blue-500 text-white';
                                             else activeClass = 'bg-slate-500 text-white';
                                         } else {
                                             activeClass = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700';
                                         }

                                         return (
                                             <button
                                                key={option}
                                                onClick={() => handleStatusChange(item.id, option)}
                                                className={`flex-1 sm:flex-none px-1 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors ${activeClass}`}
                                             >
                                                 {option}
                                             </button>
                                         );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-lg flex justify-end space-x-3 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors shadow-sm"
                    >
                        Save Inspection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InspectionModal;
