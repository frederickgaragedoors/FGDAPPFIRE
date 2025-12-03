import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Expense, BankTransaction, BankStatement, ExpenseCategory } from '../types.ts';
import { generateId, fileToDataUrl, calculateFileHash } from '../utils.ts';
import * as idb from '../db.ts';
import { useNotifications } from './NotificationContext.tsx';
import { useApp } from './AppContext.tsx';
import { GoogleGenAI, Type } from "@google/genai";

// --- HELPER FUNCTIONS ---
const parseCsv = (content: string): Record<string, string>[] => {
    const [headerLine, ...lines] = content.split('\n').filter(line => line.trim() !== '');
    if (!headerLine) return [];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    return lines.map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim();
            return obj;
        }, {} as Record<string, string>);
    });
};

const mapCsvToTransactions = (data: Record<string, string>[], fileHash: string): BankTransaction[] => {
    return data.map(row => {
        const dateKey = Object.keys(row).find(k => k.includes('date')) || '';
        const descKey = Object.keys(row).find(k => k.includes('description') || k.includes('details')) || '';
        let amount = 0;
        const debitKey = Object.keys(row).find(k => k.includes('debit') || k.includes('withdrawal'));
        const creditKey = Object.keys(row).find(k => k.includes('credit') || k.includes('deposit'));
        if (debitKey && row[debitKey]) amount = -parseFloat(row[debitKey]);
        else if (creditKey && row[creditKey]) amount = parseFloat(row[creditKey]);
        else { const amountKey = Object.keys(row).find(k => k.includes('amount')) || ''; amount = parseFloat(row[amountKey] || '0'); }
        
        return { id: generateId(), date: new Date(row[dateKey] || Date.now()).toISOString().split('T')[0], description: row[descKey] || 'Unknown', amount, isReconciled: false, createdAt: new Date().toISOString() };
    }).filter(t => t.description !== 'Unknown' && t.amount !== 0);
};

// --- CONTEXT DEFINITION ---
interface FinanceContextType {
    expenses: Expense[];
    bankTransactions: BankTransaction[];
    bankStatements: BankStatement[];
    handleSaveExpenses: (expensesToSave: Expense[], runReconciliation?: boolean) => Promise<void>;
    handleDeleteExpense: (expenseId: string) => Promise<boolean>;
    handleUnlinkExpense: (expenseToUnlink: Expense) => Promise<void>;
    handleImportBankStatement: (file: File) => Promise<{ success: boolean; error?: string }>;
    handleSaveBankTransactions: (transactionsToSave: BankTransaction[]) => Promise<void>;
    handleDeleteBankStatement: (statementId: string) => Promise<void>;
    handleDeleteAllBankData: () => Promise<void>;
    runManualReconciliation: (updatedExpenses?: Expense[] | null, updatedBankTxns?: BankTransaction[] | null) => Promise<void>;
    restoreFinanceData: (data: { expenses: Expense[], bankTransactions: BankTransaction[], bankStatements: BankStatement[] }) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);
export const useFinance = () => { const context = useContext(FinanceContext); if (!context) throw new Error('useFinance must be used within a FinanceProvider'); return context; };

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isGuestMode } = useApp();
    const { addNotification } = useNotifications();
    
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
    
    // --- DATA LOADING & SYNC ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const [sExpenses, sBank, sStatements] = await Promise.all([idb.getExpenses(), idb.getBankTransactions(), idb.getBankStatements()]);
                setExpenses(sExpenses || []);
                setBankTransactions(sBank || []);
                setBankStatements(sStatements || []);
            } else { setExpenses([]); setBankTransactions([]); setBankStatements([]); }
        };
        loadInitialData();
    }, [isGuestMode]);
    
    useEffect(() => {
        if (isGuestMode || !user || !db) return;
        const unsubExpenses = onSnapshot(collection(db, 'users', user.uid, 'expenses'), (snap) => setExpenses(snap.docs.map(d => d.data() as Expense)));
        const unsubBank = onSnapshot(collection(db, 'users', user.uid, 'bankTransactions'), (snap) => setBankTransactions(snap.docs.map(d => d.data() as BankTransaction)));
        const unsubStatements = onSnapshot(collection(db, 'users', user.uid, 'bankStatements'), (snap) => setBankStatements(snap.docs.map(d => d.data() as BankStatement)));
        return () => { unsubExpenses(); unsubBank(); unsubStatements(); };
    }, [user, isGuestMode]);

    const persistMultiple = async (store: 'expenses' | 'bank' | 'statements', data: any[]) => {
        if (isGuestMode) {
            if (store === 'expenses') await idb.saveExpenses(data);
            if (store === 'bank') await idb.saveBankTransactions(data);
            if (store === 'statements') await idb.saveBankStatements(data);
        } else if (user && db) {
            const collectionName = store === 'bank' ? 'bankTransactions' : store === 'statements' ? 'bankStatements' : 'expenses';
            const batch = writeBatch(db);
            data.forEach(item => batch.set(doc(db, 'users', user.uid, collectionName, item.id), item, { merge: true }));
            await batch.commit();
        }
    };

    const runManualReconciliation = useCallback(async (updatedExpenses: Expense[] | null = null, updatedBankTxns: BankTransaction[] | null = null) => {
        const currentExpenses = updatedExpenses || expenses; const currentBankTxns = updatedBankTxns || bankTransactions;
        const unreconciledExpenses = currentExpenses.filter(e => !e.isReconciled && !e.isDeferred);
        const unreconciledBankTxns = currentBankTxns.filter(t => !t.isReconciled && t.amount < 0);
        if (unreconciledExpenses.length === 0 || unreconciledBankTxns.length === 0) return;
        let matches = 0;
        const matchedExpenseIds = new Set<string>(); const matchedBankTxnIds = new Set<string>();
        for (const exp of unreconciledExpenses) {
            for (const txn of unreconciledBankTxns) {
                if (matchedBankTxnIds.has(txn.id)) continue;
                if (Math.abs(exp.total - Math.abs(txn.amount)) < 0.01) {
                    matchedExpenseIds.add(exp.id); matchedBankTxnIds.add(txn.id); matches++;
                    break;
                }
            }
        }
        if (matches > 0) {
            const newExpenses = currentExpenses.map(e => matchedExpenseIds.has(e.id) ? { ...e, isReconciled: true, bankTransactionIds: bankTransactions.find(t => Math.abs(e.total - Math.abs(t.amount)) < 0.01)?.id ? [bankTransactions.find(t => Math.abs(e.total - Math.abs(t.amount)) < 0.01)!.id] : [] } : e);
            const newBankTxns = currentBankTxns.map(t => matchedBankTxnIds.has(t.id) ? { ...t, isReconciled: true } : t);
            setExpenses(newExpenses); setBankTransactions(newBankTxns);
            await Promise.all([persistMultiple('expenses', newExpenses), persistMultiple('bank', newBankTxns)]);
            addNotification(`Automatically reconciled ${matches} transaction(s).`, 'success');
        } else { addNotification('No automatic matches found.', 'info'); }
    }, [expenses, bankTransactions, addNotification, isGuestMode, user, db]);

    const handleSaveExpenses = async (expensesToSave: Expense[], runReconciliation = true) => {
        const updatedExpenses = [...expenses];
        expensesToSave.forEach(exp => {
            const index = updatedExpenses.findIndex(e => e.id === exp.id);
            if (index > -1) updatedExpenses[index] = exp; else updatedExpenses.push(exp);
        });
        setExpenses(updatedExpenses); await persistMultiple('expenses', updatedExpenses);
        if(runReconciliation) runManualReconciliation(updatedExpenses);
    };

    const handleDeleteExpense = async (expenseId: string): Promise<boolean> => {
        const expenseToDelete = expenses.find(e => e.id === expenseId); if (!expenseToDelete) return false;
        const updatedExpenses = expenses.filter(e => e.id !== expenseId);
        if (expenseToDelete.bankTransactionIds) {
            const txnsToUnreconcile = bankTransactions.filter(t => expenseToDelete.bankTransactionIds?.includes(t.id)).map(t => ({...t, isReconciled: false}));
            if(txnsToUnreconcile.length > 0) handleSaveBankTransactions(txnsToUnreconcile);
        }
        setExpenses(updatedExpenses);
        if (isGuestMode) { await idb.saveExpenses(updatedExpenses); }
        else if (user && db) { await deleteDoc(doc(db, 'users', user.uid, 'expenses', expenseId)); }
        return true;
    };
    
    const handleUnlinkExpense = async (expenseToUnlink: Expense) => {
        const updatedExpense = {...expenseToUnlink, isReconciled: false, bankTransactionIds: [] };
        const txnsToUnreconcile = bankTransactions.filter(t => expenseToUnlink.bankTransactionIds?.includes(t.id)).map(t => ({...t, isReconciled: false}));
        await handleSaveExpenses([updatedExpense], false);
        await handleSaveBankTransactions(txnsToUnreconcile);
    };

    const handleImportBankStatement = async (file: File): Promise<{ success: boolean; error?: string }> => {
        try {
            const fileHash = await calculateFileHash(file);
            if (bankStatements.some(s => s.fileHash === fileHash)) return { success: false, error: `Skipped: ${file.name} (already imported).` };
            
            const content = await file.text();
            let transactions: BankTransaction[] = [];
            if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
                transactions = mapCsvToTransactions(parseCsv(content), fileHash);
            } else { return { success: false, error: 'Unsupported file type.' }; }
            
            if (transactions.length > 0) {
                const newStatement: BankStatement = { id: generateId(), fileName: file.name, fileHash, uploadedAt: new Date().toISOString(), transactionCount: transactions.length, statementPeriod: `Period for ${file.name}` };
                transactions.forEach(t => t.statementId = newStatement.id);
                setBankStatements(prev => [...prev, newStatement]);
                setBankTransactions(prev => [...prev, ...transactions]);
                await persistMultiple('statements', [...bankStatements, newStatement]);
                await persistMultiple('bank', [...bankTransactions, ...transactions]);
                runManualReconciliation(null, [...bankTransactions, ...transactions]);
            }
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    };

    const handleSaveBankTransactions = async (transactionsToSave: BankTransaction[]) => {
        const updatedTxns = [...bankTransactions];
        transactionsToSave.forEach(txn => { const index = updatedTxns.findIndex(t => t.id === txn.id); if (index > -1) updatedTxns[index] = txn; });
        setBankTransactions(updatedTxns); await persistMultiple('bank', updatedTxns);
    };

    const handleDeleteBankStatement = async (statementId: string) => {
        const txnsToDelete = bankTransactions.filter(t => t.statementId === statementId);
        const expensesToUnreconcile: Expense[] = [];
        txnsToDelete.forEach(txn => { expenses.forEach(exp => { if(exp.bankTransactionIds?.includes(txn.id)) expensesToUnreconcile.push({...exp, isReconciled: false, bankTransactionIds: []})})});
        
        const updatedStatements = bankStatements.filter(s => s.id !== statementId);
        const updatedTxns = bankTransactions.filter(t => t.statementId !== statementId);
        setBankStatements(updatedStatements); setBankTransactions(updatedTxns);
        await persistMultiple('statements', updatedStatements);
        await persistMultiple('bank', updatedTxns);
        if (expensesToUnreconcile.length > 0) await handleSaveExpenses(expensesToUnreconcile, false);
    };

    const handleDeleteAllBankData = async () => {
        const expensesToUnreconcile = expenses.filter(e => e.isReconciled).map(e => ({...e, isReconciled: false, bankTransactionIds: []}));
        setBankStatements([]); setBankTransactions([]);
        await persistMultiple('statements', []); await persistMultiple('bank', []);
        await handleSaveExpenses(expensesToUnreconcile, false);
        addNotification("All bank data cleared.", "success");
    };
    
    const restoreFinanceData = async (data: { expenses: Expense[], bankTransactions: BankTransaction[], bankStatements: BankStatement[] }) => {
        setExpenses(data.expenses);
        setBankTransactions(data.bankTransactions);
        setBankStatements(data.bankStatements);

        if (isGuestMode) {
            await idb.saveExpenses(data.expenses);
            await idb.saveBankTransactions(data.bankTransactions);
            await idb.saveBankStatements(data.bankStatements);
        } else if (user && db) {
            const collections = ['expenses', 'bankTransactions', 'bankStatements'];
             for (const coll of collections) {
                const collRef = collection(db, 'users', user.uid, coll);
                const snapshot = await getDocs(collRef);
                const batch = writeBatch(db);
                snapshot.docs.forEach(d => batch.delete(d.ref));
                
                const dataToRestore = (data as any)[coll] || [];
                dataToRestore.forEach((item: any) => batch.set(doc(db, 'users', user.uid, coll, item.id), item));
                
                await batch.commit();
            }
        }
    };

    const value: FinanceContextType = {
        expenses, bankTransactions, bankStatements,
        handleSaveExpenses, handleDeleteExpense, handleUnlinkExpense, handleImportBankStatement, handleSaveBankTransactions, handleDeleteBankStatement,
        handleDeleteAllBankData, runManualReconciliation, restoreFinanceData,
    };

    return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};
