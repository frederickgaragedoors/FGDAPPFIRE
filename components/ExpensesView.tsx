import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useFinance } from '../contexts/FinanceContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { Expense, ExpenseCategory, BankTransaction, BankStatement, ALL_EXPENSE_CATEGORIES } from '../types.ts';
import EmptyState from './EmptyState.tsx';
import ExpenseFormModal from './ExpenseDetailModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import StatementDetailModal from './StatementDetailModal.tsx';
import { CurrencyDollarIcon, UploadIcon, LinkIcon, XIcon, TrashIcon } from './icons.tsx';
import { fileToDataUrl, generateId, calculateFileHash } from '../utils.ts';

type CombinedTransaction = (Expense & { type: 'expense' }) | (BankTransaction & { type: 'bank' });

const MANUAL_CATEGORIES = ALL_EXPENSE_CATEGORIES.filter(c => c !== 'Mileage');

const PayableMatchingModal: React.FC<{
    bankTxn: BankTransaction;
    payables: Expense[];
    onMatch: (bankTxnId: string, expenseId: string) => void;
    onClose: () => void;
}> = ({ bankTxn, payables, onMatch, onClose }) => {
    const sortedPayables = useMemo(() => {
        const targetAmount = Math.abs(bankTxn.amount);
        return [...payables].sort((a, b) => {
            const diffA = Math.abs(a.total - targetAmount);
            const diffB = Math.abs(b.total - targetAmount);
            return diffA - diffB;
        });
    }, [bankTxn, payables]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Match Payable to Transaction</h3>
                    <button onClick={onClose}><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="p-4">
                    <p className="text-sm">Select the deferred expense that corresponds to this bank transaction:</p>
                    <div className="my-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                        <p className="font-semibold">{bankTxn.description}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{new Date(bankTxn.date + 'T00:00:00').toLocaleDateString()} - <span className="font-bold">${Math.abs(bankTxn.amount).toFixed(2)}</span></p>
                    </div>
                    <ul className="max-h-64 overflow-y-auto space-y-2">
                        {sortedPayables.map(p => (
                            <li key={p.id} className="p-2 border rounded-md flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700">
                                <div>
                                    <p className="font-semibold">{p.vendor}</p>
                                    <p className="text-sm text-slate-500">{new Date(p.date + 'T00:00:00').toLocaleDateString()} - <span className="font-bold">${p.total.toFixed(2)}</span></p>
                                </div>
                                <button onClick={() => onMatch(bankTxn.id, p.id)} className="px-3 py-1 bg-sky-500 text-white text-sm rounded-md hover:bg-sky-600">Select</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


const ExpensesView: React.FC = () => {
    const { 
        expenses, bankTransactions, bankStatements,
        handleSaveExpenses, handleDeleteExpense, handleImportBankStatement, 
        handleSaveBankTransactions, handleDeleteBankStatement, runManualReconciliation
    } = useFinance();
    const { businessInfo, categorizationRules } = useApp();
    const { addNotification } = useNotifications();
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [errors, setErrors] = useState<string[]>([]);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expensesToReview, setExpensesToReview] = useState<Expense[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'payables' | 'unmatched' | 'all' | 'statements'>('overview');
    const [matchingTxn, setMatchingTxn] = useState<BankTransaction | null>(null);
    const [statementToDelete, setStatementToDelete] = useState<BankStatement | null>(null);
    const [viewingStatement, setViewingStatement] = useState<BankStatement | null>(null);

    const receiptInputRef = useRef<HTMLInputElement>(null);
    const statementInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files || files.length === 0) return;
        setIsProcessing(true); setProgress({ current: 0, total: files.length }); setErrors([]);

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let newExpenses: Expense[] = [];
        const existingHashes = new Set(expenses.map(exp => exp.receiptHash).filter(Boolean));
        let skippedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgress({ current: i + 1, total: files.length });
            try {
                const fileHash = await calculateFileHash(file);
                if (existingHashes.has(fileHash)) {
                    skippedCount++;
                    continue; // Skip this file
                }

                const dataUrl = await fileToDataUrl(file);
                const base64Data = dataUrl.split(',')[1];
                const receiptPart = { inlineData: { mimeType: file.type, data: base64Data } };
                const categories: ExpenseCategory[] = ['Advertising', 'Office Supplies', 'Fuel', 'Building Materials', 'Meals & Entertainment', 'Tools & Equipment', 'Software', 'Utilities', 'Travel', 'Other', 'Bank & Processing Fee'];
                
                const jsonSchema = {
                    type: Type.OBJECT, properties: {
                        vendor: { type: Type.STRING }, date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                        total: { type: Type.NUMBER }, tax: { type: Type.NUMBER }, lineItems: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT, properties: {
                                    description: { type: Type.STRING }, amount: { type: Type.NUMBER }, category: { type: Type.STRING, enum: categories },
                                }, required: ['description', 'amount', 'category']
                            }
                        }
                    }, required: ['vendor', 'date', 'total', 'lineItems']
                };
                
                const textPart = { 
                    text: `Extract expense details from this receipt and format the response as a valid JSON object. Do not include markdown formatting like \`\`\`json. The JSON object must match this schema: ${JSON.stringify(jsonSchema)}`
                };

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [textPart, receiptPart] },
                    config: { responseMimeType: 'application/json' },
                });
                
                try {
                    const data = JSON.parse(response.text.trim());
                    newExpenses.push({
                        id: generateId(), vendor: data.vendor || 'Unknown', date: data.date || new Date().toISOString().split('T')[0],
                        total: data.total || 0, tax: data.tax || 0,
                        lineItems: (data.lineItems || []).map((item: any) => ({ ...item, id: generateId() })),
                        receiptDataUrl: dataUrl, receiptUrl: dataUrl, receiptHash: fileHash, createdAt: new Date().toISOString(), isReconciled: false,
                    });
                    existingHashes.add(fileHash);
                } catch (jsonParseError: any) {
                    setErrors(prev => [...prev, `Failed to parse JSON for ${file.name}. AI Response: ${response.text}`]);
                    continue;
                }
            } catch (err: any) { setErrors(prev => [...prev, `Error processing ${file.name}: ${err.message}`]); }
            
            if (i < files.length - 1) await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        setIsProcessing(false);
        if (receiptInputRef.current) receiptInputRef.current.value = '';

        if (skippedCount > 0) {
            addNotification(`Skipped ${skippedCount} duplicate receipt${skippedCount > 1 ? 's' : ''}.`, 'info');
        }
        
        if (newExpenses.length > 0) {
            setExpensesToReview(newExpenses);
            setEditingExpense(newExpenses[0]);
        }
    };

    const handleSaveFromReview = (savedExpense: Expense) => {
        const updatedQueue = expensesToReview.map(e => e.id === savedExpense.id ? savedExpense : e);
        const currentIndex = updatedQueue.findIndex(e => e.id === savedExpense.id);
        
        if (currentIndex + 1 < updatedQueue.length) {
            setExpensesToReview(updatedQueue);
            setEditingExpense(updatedQueue[currentIndex + 1]);
        } else {
            handleSaveExpenses(updatedQueue);
            setExpensesToReview([]);
            setEditingExpense(null);
        }
    };
    
    const handleCancelReview = () => {
        setExpensesToReview([]);
        setEditingExpense(null);
    };

    const handleStatementImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files || files.length === 0) return;
        setIsProcessing(true);
        setProgress({ current: 0, total: files.length });
        setErrors([]);
        let successfulImports = 0;
        let importErrors: string[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgress({ current: i + 1, total: files.length });
            const { success, error } = await handleImportBankStatement(file);
            if (success) {
                successfulImports++;
            } else if (error) {
                importErrors.push(error);
            }
        }

        setErrors(importErrors);

        if (successfulImports > 0) {
            addNotification(`Successfully imported ${successfulImports} bank statement(s).`, 'success');
        }
        if (importErrors.length > 0) {
            addNotification(`Failed to import ${importErrors.length} statement(s).`, 'error');
        }

        setIsProcessing(false);
        if (statementInputRef.current) statementInputRef.current.value = '';
    };

    const handleMatchPayable = (bankTxnId: string, expenseId: string) => {
        const bankTxn = bankTransactions.find(t => t.id === bankTxnId);
        const expense = expenses.find(e => e.id === expenseId);
        if (!bankTxn || !expense) return;

        const feeRate = (businessInfo.defaultProcessingFeeRate || 0) / 100;
        const txnAmount = Math.abs(bankTxn.amount);
        const feeAmount = expense.total - txnAmount;
        
        const expensesToUpdate: Expense[] = [];
        expensesToUpdate.push({ ...expense, isReconciled: true, bankTransactionIds: [bankTxn.id], isDeferred: false });
        
        if (feeRate > 0 && feeAmount > 0.01) {
            expensesToUpdate.push({
                id: generateId(), vendor: expense.vendor, date: bankTxn.date, total: feeAmount, tax: 0,
                lineItems: [{ id: generateId(), description: 'Processing Fee', amount: feeAmount, category: 'Bank & Processing Fee' }],
                receiptUrl: '', createdAt: new Date().toISOString(), isReconciled: true, bankTransactionIds: [bankTxn.id],
            });
        }
        
        handleSaveExpenses(expensesToUpdate, false);
        handleSaveBankTransactions([{...bankTxn, isReconciled: true}]);
        setMatchingTxn(null);
    };

    const reconciliationStats = useMemo(() => {
        const allUnreconciledExpenses = expenses.filter(e => !e.isReconciled);
        const payables = allUnreconciledExpenses.filter(e => e.isDeferred);
        const regularUnreconciled = allUnreconciledExpenses.filter(e => !e.isDeferred);
        const unmatchedBankTxns = bankTransactions.filter(t => !t.isReconciled && t.amount < 0);
        return {
            unreconciledExpensesCount: regularUnreconciled.length,
            unreconciledExpensesTotal: regularUnreconciled.reduce((sum, e) => sum + e.total, 0),
            unmatchedBankTxnsCount: unmatchedBankTxns.length,
            unmatchedBankTxnsTotal: unmatchedBankTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
            unreconciledExpenses: regularUnreconciled.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            unmatchedBankTxns: unmatchedBankTxns.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            payables: payables.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            payablesCount: payables.length,
            payablesTotal: payables.reduce((sum, p) => sum + p.total, 0)
        };
    }, [expenses, bankTransactions]);

    const sortedReceipts = useMemo(() => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [expenses]);
    const sortedBankTxns = useMemo(() => [...bankTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [bankTransactions]);
    const sortedStatements = useMemo(() => [...bankStatements].sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()), [bankStatements]);

    const performDeleteStatement = () => {
        if (statementToDelete) {
            handleDeleteBankStatement(statementToDelete.id);
            setStatementToDelete(null);
        }
    };
    
    const applyCategorizationRules = async () => {
        if (!categorizationRules || categorizationRules.length === 0) {
            addNotification('No rules to apply. Please create rules in Settings.', 'info');
            return;
        }

        const unmatchedTxns = bankTransactions.filter(t => !t.isReconciled && t.amount < 0 && !t.category);
        if (unmatchedTxns.length === 0) {
            addNotification('No uncategorized transactions to process.', 'info');
            return;
        }

        const updatedTxns: BankTransaction[] = [];
        let categorizedCount = 0;

        unmatchedTxns.forEach(txn => {
            let matched = false;
            for (const rule of categorizationRules) {
                if (txn.description.toLowerCase().includes(rule.keyword.toLowerCase())) {
                    updatedTxns.push({ ...txn, category: rule.category });
                    categorizedCount++;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                updatedTxns.push(txn);
            }
        });

        if (updatedTxns.some(t => t.category)) {
            await handleSaveBankTransactions(updatedTxns);
            addNotification(`Applied rules and categorized ${categorizedCount} transactions.`, 'success');
        } else {
            addNotification('No transactions matched the existing rules.', 'info');
        }
    };

    const handleManualCategorize = (txnId: string, category: ExpenseCategory) => {
        const txn = bankTransactions.find(t => t.id === txnId);
        if (txn) {
            handleSaveBankTransactions([{ ...txn, category: category === 'Uncategorized' ? undefined : category }]);
        }
    };

    if (isProcessing) return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-900">
            <div className="w-16 h-16 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
            <h2 className="text-xl font-bold mt-6">Processing...</h2>
            <p className="mt-2 text-slate-500">Analyzing {progress.current} of {progress.total}.</p>
            {errors.length > 0 && <div className="mt-4 text-xs text-red-600 bg-red-50 p-3 rounded-md max-w-md">{errors.join(', ')}</div>}
        </div>
    );
    
    const TabButton = ({ tab, label }: { tab: string, label: string }) => (
        <button onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{label}</button>
    );

    const StatCard = ({ title, value, subtext, action }: { title: string, value: string, subtext: string, action?: React.ReactNode }) => (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                    <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{subtext}</p>
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        </div>
    );

    const ExpenseRow: React.FC<{ item: Expense }> = ({ item }) => (
         <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" tabIndex={0} onClick={() => setEditingExpense(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditingExpense(item)}}>
            <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-slate-600 dark:text-slate-300">{new Date(item.date + 'T00:00:00').toLocaleDateString()}</td>
            <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.vendor}</td>
            <td className="px-4 py-3 text-sm font-bold text-right whitespace-nowrap text-slate-800 dark:text-slate-100">${item.total.toFixed(2)}</td>
            <td className="px-4 py-3 text-center">{item.isReconciled && <LinkIcon className="w-5 h-5 text-green-500 mx-auto" />}</td>
        </tr>
    );
    
    const BankTxnRow: React.FC<{ item: BankTransaction }> = ({ item }) => (
         <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-slate-600 dark:text-slate-300">{new Date(item.date + 'T00:00:00').toLocaleDateString()}</td>
            <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">{item.description}</td>
            <td className={`px-4 py-3 text-sm font-bold text-right whitespace-nowrap ${item.amount > 0 ? 'text-green-600' : 'text-slate-800 dark:text-slate-100'}`}>
                {`${item.amount > 0 ? '+' : ''}$${item.amount.toFixed(2)}`}
            </td>
            <td className="px-4 py-3 text-center">{item.isReconciled && <LinkIcon className="w-5 h-5 text-green-500 mx-auto" />}</td>
        </tr>
    );


    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
             <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Expenses & Reconciliation</h1>
                    <p className="mt-1 text-slate-500">Track spending and match it with your bank statements.</p>
                </div>
                <div className="flex gap-2">
                    <input type="file" multiple accept="image/*,application/pdf" ref={receiptInputRef} onChange={handleFileImport} className="hidden" />
                    <input type="file" multiple accept=".csv,.pdf" ref={statementInputRef} onChange={handleStatementImport} className="hidden" />
                    <button onClick={() => statementInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"><UploadIcon className="w-4 h-4" />Bank CSV/PDF</button>
                    <button onClick={() => receiptInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600"><UploadIcon className="w-4 h-4" />Receipts</button>
                </div>
            </div>

            <div className="p-4 sm:p-6 flex-grow space-y-6">
                {expenses.length === 0 && bankTransactions.length === 0 ? (
                    <EmptyState Icon={CurrencyDollarIcon} title="No Expenses or Transactions" message="Get started by importing receipts or a bank statement." />
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-lg space-x-1">
                            <TabButton tab="overview" label="Overview" />
                            <TabButton tab="payables" label="Payables" />
                            <TabButton tab="unmatched" label="Unmatched" />
                            <TabButton tab="all" label="All Transactions" />
                            <TabButton tab="statements" label="Statements" />
                        </div>

                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <StatCard title="Awaiting Payment" value={`${reconciliationStats.payablesCount}`} subtext={`Totaling $${reconciliationStats.payablesTotal.toFixed(2)}`} />
                                <StatCard title="Unreconciled Receipts" value={`${reconciliationStats.unreconciledExpensesCount}`} subtext={`Totaling $${reconciliationStats.unreconciledExpensesTotal.toFixed(2)}`} 
                                    action={<button onClick={() => runManualReconciliation()} className="px-3 py-1 bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 text-sm rounded-md hover:bg-sky-200">Run Reconciliation</button>}
                                />
                                <StatCard title="Unmatched Bank Debits" value={`${reconciliationStats.unmatchedBankTxnsCount}`} subtext={`Totaling $${reconciliationStats.unmatchedBankTxnsTotal.toFixed(2)}`} />
                            </div>
                        )}

                        {activeTab === 'payables' && (
                             <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border overflow-hidden">
                                <div className="p-4"><h3 className="font-semibold">Deferred expenses awaiting payment.</h3></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 uppercase">
                                            <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Vendor</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-center">Synced</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{reconciliationStats.payables.map(e => <ExpenseRow key={e.id} item={e}/>)}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'unmatched' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Unreconciled Receipts ({reconciliationStats.unreconciledExpensesCount})</h3>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left"><tbody>{reconciliationStats.unreconciledExpenses.map(e => <ExpenseRow key={e.id} item={e}/>)}</tbody></table>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-semibold">Unmatched Bank Transactions ({reconciliationStats.unmatchedBankTxnsCount})</h3>
                                        <button onClick={applyCategorizationRules} className="px-3 py-1 bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 text-sm rounded-md hover:bg-sky-200">Apply Rules</button>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left">
                                            <tbody>
                                                {reconciliationStats.unmatchedBankTxns.map(t => (
                                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                        <td className="px-4 py-3 text-sm">{new Date(t.date + 'T00:00:00').toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-sm font-semibold">{t.description}</td>
                                                        <td className="px-4 py-3 text-sm font-bold text-right">${Math.abs(t.amount).toFixed(2)}</td>
                                                        <td className="px-4 py-3">
                                                            <select value={t.category || 'Uncategorized'} onChange={(e) => handleManualCategorize(t.id, e.target.value as ExpenseCategory)} className="text-xs border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                                                                {MANUAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-right"><button onClick={() => setMatchingTxn(t)} className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded hover:bg-sky-200">Match</button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'all' && (
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Receipts ({sortedReceipts.length})</h3>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left"><tbody>{sortedReceipts.map(e => <ExpenseRow key={e.id} item={e}/>)}</tbody></table>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Bank Transactions ({sortedBankTxns.length})</h3>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left"><tbody>{sortedBankTxns.map(t => <BankTxnRow key={t.id} item={t} />)}</tbody></table>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'statements' && (
                             <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border overflow-hidden">
                                <div className="p-4"><h3 className="font-semibold">Uploaded Bank Statements</h3></div>
                                {sortedStatements.length > 0 ? (
                                     <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2">Period</th>
                                                    <th className="px-4 py-2">File Name</th>
                                                    <th className="px-4 py-2">Uploaded</th>
                                                    <th className="px-4 py-2 text-center">Transactions</th>
                                                    <th className="px-4 py-2 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {sortedStatements.map(s => (
                                                    <tr key={s.id}>
                                                        <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{s.statementPeriod || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 truncate max-w-xs">{s.fileName}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{new Date(s.uploadedAt).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">{s.transactionCount}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button onClick={() => setViewingStatement(s)} className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600">View</button>
                                                            <button onClick={() => setStatementToDelete(s)} className="p-2 text-slate-400 hover:text-red-500 ml-2"><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="p-8 text-center text-slate-500">No bank statements have been uploaded yet.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {(editingExpense) && 
                <ExpenseFormModal 
                    key={editingExpense.id}
                    expense={editingExpense} 
                    onClose={() => { setEditingExpense(null); handleCancelReview(); }} 
                    onSave={(exp, runRecon) => {
                        if (expensesToReview.length > 0) {
                            handleSaveFromReview(exp);
                        } else {
                            handleSaveExpenses([exp], runRecon);
                            setEditingExpense(null);
                        }
                    }}
                    onDelete={(id) => { handleDeleteExpense(id); setEditingExpense(null); }}
                />
            }
            {matchingTxn && (
                <PayableMatchingModal 
                    bankTxn={matchingTxn} 
                    payables={reconciliationStats.payables}
                    onMatch={handleMatchPayable}
                    onClose={() => setMatchingTxn(null)}
                />
            )}
            {statementToDelete && (
                <ConfirmationModal 
                    isOpen={!!statementToDelete}
                    onClose={() => setStatementToDelete(null)}
                    onConfirm={performDeleteStatement}
                    title="Delete Statement"
                    message={`Are you sure you want to delete "${statementToDelete.fileName}"? This will also delete ${statementToDelete.transactionCount} associated bank transactions and unreconcile any linked receipts.`}
                />
            )}
            {viewingStatement && (
                <StatementDetailModal
                    statement={viewingStatement}
                    transactions={bankTransactions.filter(t => t.statementId === viewingStatement.id)}
                    onClose={() => setViewingStatement(null)}
                />
            )}
        </div>
    );
};

export default ExpensesView;