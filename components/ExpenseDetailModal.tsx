import React, { useState, useEffect, useMemo } from 'react';
import { Expense, ExpenseLineItem, ALL_EXPENSE_CATEGORIES, ExpenseCategory } from '../types.ts';
import { XIcon, TrashIcon, PlusIcon, EyeIcon } from './icons.tsx';
import { generateId } from '../utils.ts';

interface ExpenseFormModalProps {
    expense: Expense;
    onSave: (expense: Expense, runReconciliation: boolean) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const ExpenseDetailModal: React.FC<ExpenseFormModalProps> = ({ expense, onSave, onClose, onDelete }) => {
    const [vendor, setVendor] = useState('');
    const [date, setDate] = useState('');
    const [tax, setTax] = useState<number | ''>(0);
    const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
    const [isDeferred, setIsDeferred] = useState(false);

    useEffect(() => {
        setVendor(expense.vendor);
        setDate(expense.date);
        setTax(expense.tax || 0);
        setLineItems(expense.lineItems.map(item => ({ ...item })));
        setIsDeferred(expense.isDeferred || false);
    }, [expense]);

    const handleLineItemChange = (id: string, field: keyof ExpenseLineItem, value: any) => {
        setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddLineItem = () => {
        setLineItems(prev => [...prev, { id: generateId(), description: '', amount: 0, category: 'Uncategorized' }]);
    };

    const handleRemoveLineItem = (id: string) => {
        setLineItems(prev => prev.filter(item => item.id !== id));
    };

    const calculatedTotal = useMemo(() => {
        const itemsTotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        return itemsTotal + Number(tax || 0);
    }, [lineItems, tax]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedExpense: Expense = {
            ...expense,
            vendor,
            date,
            tax: Number(tax || 0),
            lineItems: lineItems.map(item => ({ ...item, amount: Number(item.amount || 0) })),
            total: calculatedTotal,
            isDeferred
        };
        // Trigger reconciliation if amounts changed
        const runReconciliation = updatedExpense.total !== expense.total || updatedExpense.date !== expense.date;
        onSave(updatedExpense, runReconciliation);
    };

    const handleViewReceipt = async () => {
        const url = expense.receiptDataUrl || expense.receiptUrl;
        if (!url) return;

        // FIX: Modern browsers often block navigating directly to data: URLs.
        // Convert to a Blob URL for safe opening.
        if (url.startsWith('data:')) {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const newWindow = window.open(blobUrl, '_blank');
                if (!newWindow) {
                    alert("Please allow popups to view the receipt.");
                }
            } catch (e) {
                console.error("Error processing receipt image:", e);
                alert("Could not open receipt image.");
            }
        } else {
            window.open(url, '_blank');
        }
    };

    const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <form onSubmit={handleSave} className="flex flex-col flex-grow min-h-0">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Edit Expense</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">ID: {expense.id}</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 overflow-y-auto flex-grow">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyles}>Vendor</label>
                                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} className={inputStyles} required />
                            </div>
                            <div>
                                <label className={labelStyles}>Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyles} required />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Line Items</h3>
                                <button type="button" onClick={handleAddLineItem} className="text-sm text-sky-600 dark:text-sky-400 hover:underline flex items-center">
                                    <PlusIcon className="w-4 h-4 mr-1" /> Add Item
                                </button>
                            </div>
                            <div className="space-y-3">
                                {lineItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-2 items-end p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Description</label>
                                            <input type="text" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} className={inputStyles} placeholder="Item name" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Category</label>
                                            <select value={item.category} onChange={e => handleLineItemChange(item.id, 'category', e.target.value as ExpenseCategory)} className={inputStyles}>
                                                {ALL_EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                                <input type="number" step="0.01" value={item.amount} onChange={e => handleLineItemChange(item.id, 'amount', parseFloat(e.target.value))} className={`${inputStyles} pl-6`} />
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveLineItem(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 mb-[1px]">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <div>
                                <label className={labelStyles}>Tax</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                    <input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`${inputStyles} pl-6`} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4">
                                <div className="text-right">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">${calculatedTotal.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <div className="flex items-center">
                                <input
                                    id="deferred-payment"
                                    type="checkbox"
                                    checked={isDeferred}
                                    onChange={(e) => setIsDeferred(e.target.checked)}
                                    className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300 rounded"
                                />
                                <label htmlFor="deferred-payment" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                    Mark as Payable (Deferred Payment)
                                </label>
                            </div>
                            {(expense.receiptUrl || expense.receiptDataUrl) && (
                                <button type="button" onClick={handleViewReceipt} className="ml-auto flex items-center text-sm text-sky-600 dark:text-sky-400 hover:underline">
                                    <EyeIcon className="w-4 h-4 mr-1" /> View Receipt
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <button type="button" onClick={() => onDelete(expense.id)} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center">
                            <TrashIcon className="w-4 h-4 mr-1" /> Delete
                        </button>
                        <div className="flex space-x-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseDetailModal;