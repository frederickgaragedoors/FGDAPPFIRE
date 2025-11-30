import React, { useState, useMemo } from 'react';
import { Expense, BankTransaction } from '../types.ts';
import { XIcon } from './icons.tsx';

interface TransactionLinkerModalProps {
    expense: Expense;
    unreconciledDebits: BankTransaction[];
    onLink: (transactionIds: string[]) => void;
    onClose: () => void;
}

const TransactionLinkerModal: React.FC<TransactionLinkerModalProps> = ({ expense, unreconciledDebits, onLink, onClose }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const { selectedTotal, difference } = useMemo(() => {
        const selectedTotal = unreconciledDebits
            .filter(t => selectedIds.includes(t.id))
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const difference = expense.total - selectedTotal;
        return { selectedTotal, difference };
    }, [selectedIds, unreconciledDebits, expense.total]);
    
    const sortedDebits = useMemo(() => {
        return [...unreconciledDebits].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [unreconciledDebits]);

    const isBalanced = Math.abs(difference) < 0.01;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Link Transactions</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Match bank debits to: <span className="font-semibold text-slate-700 dark:text-slate-200">{expense.vendor} - ${expense.total.toFixed(2)}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    <ul className="space-y-2">
                        {sortedDebits.map(t => (
                            <li key={t.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(t.id)}
                                    onChange={() => handleToggle(t.id)}
                                    className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 flex-shrink-0"
                                />
                                <div className="flex-grow">
                                    <p className="font-medium text-slate-800 dark:text-slate-100">{t.description}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(t.date + 'T00:00:00').toLocaleDateString()}</p>
                                </div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">${Math.abs(t.amount).toFixed(2)}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t dark:border-slate-700 flex-shrink-0">
                    <div className="text-sm space-y-1">
                        <div className="flex justify-between w-48"><span className="font-medium text-slate-600 dark:text-slate-300">Selected:</span> <span className="font-bold">${selectedTotal.toFixed(2)}</span></div>
                        <div className={`flex justify-between w-48 ${!isBalanced ? 'text-red-500' : 'text-green-600'}`}><span className="font-medium">Difference:</span> <span className="font-bold">${difference.toFixed(2)}</span></div>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                        <button onClick={() => onLink(selectedIds)} disabled={selectedIds.length === 0} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed">
                            Link {selectedIds.length} Transaction{selectedIds.length !== 1 && 's'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionLinkerModal;
