import React, { useState, useEffect, useRef } from 'react';
import { JobTicket, Supplier } from '../types.ts';
import { XIcon } from './icons.tsx';

interface AddTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { supplier: Supplier; tripType: string; date: string; }) => void;
    job: JobTicket;
    suppliers: Supplier[];
}

const AddTripModal: React.FC<AddTripModalProps> = ({ isOpen, onClose, onSave, job, suppliers }) => {
    const [supplierId, setSupplierId] = useState('');
    const [tripType, setTripType] = useState('roundtrip');
    const [date, setDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDate(job.date);
            setSupplierId(suppliers[0]?.id || '');
            setTripType('roundtrip');
        }
    }, [isOpen, job.date, suppliers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        if (selectedSupplier) {
            onSave({ supplier: selectedSupplier, tripType, date });
        }
    };

    if (!isOpen) return null;

    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add Supplier Trip</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="supplier" className={labelStyles}>Supplier</label>
                            <select id="supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputStyles} required>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="tripType" className={labelStyles}>Trip Type</label>
                            <select id="tripType" value={tripType} onChange={e => setTripType(e.target.value)} className={inputStyles} required>
                                <option value="before">Before visiting customer</option>
                                <option value="roundtrip">Mid-job: To supplier & return</option>
                                <option value="to_supplier">Mid-job: To supplier (one-way)</option>
                                <option value="from_supplier">Mid-job: From supplier (one-way)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="tripDate" className={labelStyles}>Date of Trip</label>
                            <input id="tripDate" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyles} required />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end space-x-2 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">Add Trip</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTripModal;