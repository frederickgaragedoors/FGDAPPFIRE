import React, { useState, useEffect, useMemo } from 'react';
import { Expense, ExpenseCategory, ExpenseLineItem, ALL_EXPENSE_CATEGORIES, BankTransaction } from '../types.ts';
import { XIcon, FileIcon, TrashIcon, PlusIcon, LinkIcon } from './icons.tsx';
import { generateId } from '../utils.ts';
import { useFinance } from '../contexts/FinanceContext.tsx';
import TransactionLinkerModal from './TransactionLinkerModal.tsx';

interface ExpenseFormModalProps {
  expense: Expense;
  onSave: (expense: Expense, runReconciliation?: boolean) => void;
  onDelete: (expenseId: string) => void;
  onClose: () => void;
}

const EDITABLE_CATEGORIES = ALL_EXPENSE_CATEGORIES.filter(c => c !== 'Mileage' && c !== 'Uncategorized');

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({ expense, onSave, onDelete, onClose }) => {
  const { bankTransactions, handleSaveBankTransactions, handleUnlinkExpense } = useFinance();
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState<number | ''>('');
  const [tax, setTax] = useState<number | ''>('');
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [isDeferred, setIsDeferred] = useState(false);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);

  useEffect(() => {
    if (expense) {
      setVendor(expense.vendor);
      setDate(expense.date);
      setTotal(expense.total);
      setTax(expense.tax);
      setLineItems([...expense.lineItems]);
      setIsDeferred(expense.isDeferred || false);
    }
  }, [expense]);
  
  const handleLineItemChange = (id: string, field: keyof ExpenseLineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: generateId(), description: '', amount: 0, category: 'Other' }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };
  
  const handleSave = () => {
    onSave({
      ...expense,
      vendor,
      date,
      total: Number(total || 0),
      tax: Number(tax || 0),
      lineItems,
      isDeferred,
    });
  };
  
  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
        onDelete(expense.id);
    }
  };

  const handleLink = (txnIds: string[]) => {
    const updatedExpense = { ...expense, isReconciled: true, bankTransactionIds: txnIds, isDeferred: false };
    onSave(updatedExpense, false); // Pass false to prevent reconciliation race condition
    const txnsToUpdate = bankTransactions.filter(t => txnIds.includes(t.id)).map(t => ({ ...t, isReconciled: true }));
    handleSaveBankTransactions(txnsToUpdate);
    setIsLinkerOpen(false);
  };

  const handleUnlink = () => {
    handleUnlinkExpense(expense);
    onClose();
  };

  const unreconciledDebits = useMemo(() => bankTransactions.filter(t => t.amount < 0 && !t.isReconciled), [bankTransactions]);
  const linkedTransactions = useMemo(() => bankTransactions.filter(t => expense.bankTransactionIds?.includes(t.id)), [bankTransactions, expense.bankTransactionIds]);

  const inputStyles = "block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm";
  const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700 flex-shrink-0">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Edit Expense</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Review and edit the details for this expense.
                    </p>
                </div>
                <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <XIcon className="w-5 h-5" />
                </button>
            </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-grow min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="vendor" className={labelStyles}>Vendor</label>
                        <input id="vendor" type="text" value={vendor} onChange={e => setVendor(e.target.value)} className={`mt-1 ${inputStyles}`} />
                    </div>
                    <div>
                        <label htmlFor="date" className={labelStyles}>Date</label>
                        <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className={`mt-1 ${inputStyles}`} />
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                <div className="relative mt-1 flex-grow">
                    <label htmlFor="total" className={labelStyles}>Total Amount</label>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pt-6">
                        <span className="text-slate-500 sm:text-sm">$</span>
                    </div>
                    <input id="total" type="number" value={total} onChange={e => setTotal(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`mt-1 ${inputStyles} pl-7`} />
                </div>
                <div className="relative mt-1 flex-grow">
                    <label htmlFor="tax" className={labelStyles}>Tax</label>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pt-6">
                        <span className="text-slate-500 sm:text-sm">$</span>
                    </div>
                    <input id="tax" type="number" value={tax} onChange={e => setTax(e.target.value === '' ? '' : parseFloat(e.target.value))} className={`mt-1 ${inputStyles} pl-7`} />
                </div>
                <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="self-end flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-sky-600 bg-sky-100 dark:bg-sky-900/50 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors">
                    <FileIcon className="w-4 h-4" /><span>Receipt</span>
                </a>
                </div>

            <div>
                <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-2">Itemized Details</h3>
                <div className="space-y-2">
                    {lineItems.map(item => (
                        <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-2 items-end">
                            <div className="flex-grow">
                            <label className="text-xs text-slate-500">Description</label>
                            <input type="text" value={item.description} onChange={e => handleLineItemChange(item.id, 'description', e.target.value)} className={inputStyles} />
                            </div>
                            <div>
                            <label className="text-xs text-slate-500">Category</label>
                            <select value={item.category} onChange={e => handleLineItemChange(item.id, 'category', e.target.value)} className={inputStyles}>
                                    {EDITABLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            </div>
                            <div>
                            <label className="text-xs text-slate-500">Amount</label>
                            <input type="number" value={item.amount} onChange={e => handleLineItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)} className={`${inputStyles} text-right`} />
                            </div>
                            <button onClick={() => removeLineItem(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full dark:hover:bg-red-900/50"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <button onClick={addLineItem} className="mt-2 text-sm text-sky-600 font-medium flex items-center space-x-1"><PlusIcon className="w-4 h-4"/><span>Add Item</span></button>
            </div>
            
            <div className="!mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isDeferred}
                            onChange={(e) => setIsDeferred(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="flex-grow">
                            <span className="font-medium text-slate-800 dark:text-slate-100">Mark as Deferred Payment</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Check this for invoices you'll pay later. It will be excluded from automatic reconciliation.</p>
                        </div>
                    </label>
            </div>

            <div className="!mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-2">Reconciliation</h3>
                {expense.isReconciled ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200 flex items-center gap-2"><LinkIcon className="w-5 h-5"/>Reconciled</p>
                            <button onClick={handleUnlink} className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Unlink</button>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-green-700 dark:text-green-300">
                            {linkedTransactions.map(t => (
                                <li key={t.id} className="flex justify-between">
                                    <span>{t.description}</span>
                                    <span className="font-mono">${Math.abs(t.amount).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md text-center">
                         <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">This expense is not reconciled.</p>
                        <button onClick={() => setIsLinkerOpen(true)} className="px-4 py-2 text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 rounded-md hover:bg-sky-200 dark:hover:bg-sky-800">
                            Link Bank Transactions...
                        </button>
                    </div>
                )}
            </div>

            </div>

            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t dark:border-slate-700 flex-shrink-0">
                <button 
                    onClick={handleDelete} 
                    className="px-4 py-2 rounded-md text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                >
                    Delete
                </button>
                <div className="flex space-x-3">
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
                        Save Expense
                    </button>
                </div>
            </div>
        </div>
        </div>
        {isLinkerOpen && (
            <TransactionLinkerModal
                expense={expense}
                unreconciledDebits={unreconciledDebits}
                onLink={handleLink}
                onClose={() => setIsLinkerOpen(false)}
            />
        )}
    </>
  );
};

export default ExpenseFormModal;
