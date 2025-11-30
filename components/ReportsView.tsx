import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext.tsx';
import BarChart from './charts/BarChart.tsx';
import DonutChart from './charts/DonutChart.tsx';
import { ExpenseCategory, Expense, BankTransaction } from '../types.ts';
import { exportToCsv } from '../utils.ts';

type TimeFrame = 'month' | '30d' | 'year' | 'all';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
    'Advertising': '#14b8a6', // teal-500
    'Fuel': '#f59e0b', // amber-500
    'Building Materials': '#10b981', // emerald-500
    'Tools & Equipment': '#6366f1', // indigo-500
    'Office Supplies': '#3b82f6', // blue-500
    'Meals & Entertainment': '#ec4899', // pink-500
    'Software': '#8b5cf6', // violet-500
    'Utilities': '#06b6d4', // cyan-500
    'Travel': '#d946ef', // fuchsia-500
    'Bank & Processing Fee': '#ef4444', // red-500
    'Mileage': '#f97316', // orange-500
    'Uncategorized': '#6b7280', // gray-500
    'Other': '#84cc16', // lime-500
};

const getIsoDate = (date: Date) => date.toISOString().split('T')[0];

const ReportsView: React.FC = () => {
    const { expenses, bankTransactions, mileageLogs, businessInfo } = useData();
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');

    // State for export date range
    const [exportStartDate, setExportStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return getIsoDate(d);
    });
    const [exportEndDate, setExportEndDate] = useState(getIsoDate(new Date()));

    const financialData = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (timeFrame) {
            case '30d':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
                startDate = new Date(0); // Epoch
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }
        startDate.setHours(0,0,0,0);
        
        const inDateRange = (dateStr: string) => {
            const date = new Date(dateStr + 'T00:00:00');
            return date >= startDate && date <= endDate;
        };

        const income = bankTransactions
            .filter(t => t.amount > 0 && inDateRange(t.date))
            .reduce((sum, t) => sum + t.amount, 0);

        let totalExpenses = 0;
        const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};

        // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated filter logic.
        const reconciledExpenses = expenses.filter(e => e.isReconciled && e.bankTransactionIds && e.bankTransactionIds.length > 0 && inDateRange(e.date));

        for (const exp of reconciledExpenses) {
            totalExpenses += exp.total;
            for (const item of exp.lineItems) {
                expensesByCategory[item.category] = (expensesByCategory[item.category] || 0) + item.amount;
            }
            if(exp.tax > 0 && exp.lineItems.length > 0) {
                 expensesByCategory[exp.lineItems[0].category] = (expensesByCategory[exp.lineItems[0].category] || 0) + exp.tax;
            }

            // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated find logic.
            const bankTxn = bankTransactions.find(t => exp.bankTransactionIds?.includes(t.id));
            if (bankTxn) {
                const fee = exp.total - Math.abs(bankTxn.amount);
                if (fee > 0.01) {
                    expensesByCategory['Bank & Processing Fee'] = (expensesByCategory['Bank & Processing Fee'] || 0) + fee;
                }
            }
        }
        
        const unmatchedBankTxns = bankTransactions.filter(t => t.amount < 0 && !t.isReconciled && inDateRange(t.date));
        for (const txn of unmatchedBankTxns) {
            const amount = Math.abs(txn.amount);
            totalExpenses += amount;
            const category = txn.category || 'Uncategorized';
            expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
        }

        const mileageRate = businessInfo.standardMileageRate || 0;
        const relevantMileage = mileageLogs.filter(log => inDateRange(log.date));
        const totalMileageCost = relevantMileage.reduce((sum, log) => sum + (log.distance * mileageRate), 0);
        
        if (totalMileageCost > 0) {
            totalExpenses += totalMileageCost;
            expensesByCategory['Mileage'] = (expensesByCategory['Mileage'] || 0) + totalMileageCost;
        }
        
        const netProfit = income - totalExpenses;

        const expenseChartData = Object.entries(expensesByCategory)
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({
                label: label as ExpenseCategory,
                value,
                color: CATEGORY_COLORS[label as ExpenseCategory] || '#a3a3a3'
            }))
            .sort((a,b) => b.value - a.value);

        return { income, totalExpenses, netProfit, expenseChartData };

    }, [timeFrame, expenses, bankTransactions, mileageLogs, businessInfo]);

    const handleExportMileage = () => {
        const start = new Date(exportStartDate + 'T00:00:00');
        const end = new Date(exportEndDate + 'T23:59:59');

        const filteredLogs = mileageLogs.filter(log => {
            const logDate = new Date(log.date + 'T00:00:00');
            return logDate >= start && logDate <= end;
        });

        if (filteredLogs.length === 0) {
            alert("No mileage data in selected range.");
            return;
        }
        
        const mileageRate = businessInfo.standardMileageRate || 0;

        const dataToExport = filteredLogs.map(log => ({
            'Date': log.date,
            'Purpose/Notes': log.notes,
            'Start Location': log.startAddress,
            'End Location': log.endAddress,
            'Distance (mi)': log.distance,
            // FIX: The result of toFixed(2) is a string, which can cause type errors in calculations.
            // Using Math.round to keep the value as a number.
            'Deduction ($)': Math.round((log.distance * mileageRate) * 100) / 100,
        }));
        
        const totalMiles = dataToExport.reduce((sum, row) => sum + Number(row['Distance (mi)']), 0);
        const totalDeduction = dataToExport.reduce((sum, row) => sum + Number(row['Deduction ($)']), 0);
        
        // FIX: The type of dataToExport is inferred as an array of objects with potentially mixed types.
        // Explicitly casting to `any[]` to handle the addition of a summary row with different types.
        const finalDataToExport: any[] = dataToExport;

        finalDataToExport.push({
            'Date': 'TOTAL',
            'Purpose/Notes': '',
            'Start Location': '',
            'End Location': '',
            'Distance (mi)': totalMiles.toFixed(2),
            'Deduction ($)': totalDeduction.toFixed(2),
        });

        exportToCsv(finalDataToExport, `Mileage-Report_${exportStartDate}_to_${exportEndDate}.csv`);
    };
    
    const handleExportExpenses = () => {
        const start = new Date(exportStartDate + 'T00:00:00');
        const end = new Date(exportEndDate + 'T23:59:59');

        const inDateRange = (dateStr: string) => {
            const date = new Date(dateStr + 'T00:00:00');
            return date >= start && date <= end;
        };

        const dataToExport: any[] = [];
        
        // 1. Reconciled expenses (receipts with matching bank transactions)
        // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated filter logic.
        expenses.filter(e => e.isReconciled && e.bankTransactionIds && e.bankTransactionIds.length > 0 && inDateRange(e.date)).forEach(exp => {
            // FIX: Replaced `bankTransactionId` with `bankTransactionIds` and updated find logic.
            const bankTxn = bankTransactions.find(t => exp.bankTransactionIds?.includes(t.id));
            const fee = bankTxn ? exp.total - Math.abs(bankTxn.amount) : 0;

            exp.lineItems.forEach((item, index) => {
                dataToExport.push({
                    'Date': exp.date,
                    'Description/Vendor': index === 0 ? exp.vendor : item.description,
                    'Category': item.category,
                    'Amount': item.amount,
                    'Status': 'Reconciled',
                    'Reconciliation Note': `Matched to bank transaction from ${bankTxn?.date}`
                });
            });
            if (fee > 0.01) {
                dataToExport.push({
                    'Date': bankTxn?.date || exp.date,
                    'Description/Vendor': `${exp.vendor} - Processing Fee`,
                    'Category': 'Bank & Processing Fee',
                    'Amount': fee,
                    'Status': 'Reconciled',
                    'Reconciliation Note': `Fee from bank transaction`
                });
            }
        });

        // 2. Unreconciled receipts
        expenses.filter(e => !e.isReconciled && !e.isDeferred && inDateRange(e.date)).forEach(exp => {
             exp.lineItems.forEach((item, index) => {
                dataToExport.push({
                    'Date': exp.date,
                    'Description/Vendor': index === 0 ? exp.vendor : item.description,
                    'Category': item.category,
                    'Amount': item.amount,
                    'Status': 'Unreconciled (Receipt)',
                    'Reconciliation Note': 'No matching bank transaction found'
                });
             });
        });
        
        // 3. Deferred payables
        expenses.filter(e => e.isDeferred && inDateRange(e.date)).forEach(exp => {
            exp.lineItems.forEach((item, index) => {
                dataToExport.push({
                    'Date': exp.date,
                    'Description/Vendor': index === 0 ? exp.vendor : item.description,
                    'Category': item.category,
                    'Amount': item.amount,
                    'Status': 'Payable (Deferred)',
                    'Reconciliation Note': 'Marked to be paid later'
                });
            });
        });

        // 4. Unmatched, categorized bank debits
        bankTransactions.filter(t => t.amount < 0 && !t.isReconciled && t.category && inDateRange(t.date)).forEach(txn => {
            dataToExport.push({
                'Date': txn.date,
                'Description/Vendor': txn.description,
                'Category': txn.category,
                'Amount': Math.abs(txn.amount),
                'Status': 'Unreconciled (Bank Debit)',
                'Reconciliation Note': 'No matching receipt found'
            });
        });
        
        // 5. Mileage
        const mileageRate = businessInfo.standardMileageRate || 0;
        mileageLogs.filter(log => inDateRange(log.date)).forEach(log => {
             dataToExport.push({
                'Date': log.date,
                'Description/Vendor': log.notes || 'Mileage',
                'Category': 'Mileage',
                // FIX: The result of `toFixed(2)` is a string, which caused a type error.
                // Replaced with a calculation that rounds to 2 decimal places while keeping the type as a number.
                'Amount': Math.round((log.distance * mileageRate) * 100) / 100,
                'Status': 'Auto-logged',
                'Reconciliation Note': `${log.distance} mi @ $${mileageRate}/mi`
            });
        });
        
        if (dataToExport.length === 0) {
            alert("No expense data in selected range.");
            return;
        }

        // Sort by date
        dataToExport.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
        
        exportToCsv(dataToExport, `Expense-Report_${exportStartDate}_to_${exportEndDate}.csv`);
    };

    const TimeFrameButton: React.FC<{ frame: TimeFrame, label: string }> = ({ frame, label }) => (
        <button
            onClick={() => setTimeFrame(frame)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeFrame === frame
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
        >
            {label}
        </button>
    );

    const StatCard: React.FC<{ title: string, value: number, colorClass: string }> = ({ title, value, colorClass }) => (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
            <p className={`text-4xl font-bold mt-2 ${colorClass}`}>
                {value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                     <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Financial Reports</h1>
                    <div className="flex items-center space-x-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                        <TimeFrameButton frame="month" label="This Month" />
                        <TimeFrameButton frame="30d" label="Last 30 Days" />
                        <TimeFrameButton frame="year" label="This Year" />
                        <TimeFrameButton frame="all" label="All Time" />
                    </div>
                </div>
            </div>
             <div className="p-4 sm:p-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Income" value={financialData.income} colorClass="text-green-600 dark:text-green-500" />
                    <StatCard title="Total Expenses" value={financialData.totalExpenses} colorClass="text-red-600 dark:text-red-500" />
                    <StatCard title="Net Profit" value={financialData.netProfit} colorClass={financialData.netProfit >= 0 ? "text-slate-800 dark:text-slate-100" : "text-red-600 dark:text-red-500"} />
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Income vs. Expenses</h2>
                    <BarChart data={[
                        { label: 'Income', value: financialData.income, color: '#16a34a' },
                        { label: 'Expenses', value: financialData.totalExpenses, color: '#dc2626' }
                    ]}/>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Expense Breakdown</h2>
                    <DonutChart data={financialData.expenseChartData} />
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Data Exports for Accounting</h2>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Start Date</label>
                            <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">End Date</label>
                            <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div className="flex gap-2">
                           <button onClick={handleExportMileage} className="px-4 py-2 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600">Export Mileage Log</button>
                           <button onClick={handleExportExpenses} className="px-4 py-2 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600">Export Expense Report</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
