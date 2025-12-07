import React, { useState, useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext.tsx';
import { useMileage } from '../contexts/MileageContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { BarChart } from './charts/BarChart.tsx';
import { DonutChart } from './charts/DonutChart.tsx';
import { ExpenseCategory } from '../types.ts';
import { exportToCsv } from '../utils.ts';
import { ChevronLeftIcon, ChevronRightIcon } from './icons.tsx';

type ViewType = 'day' | 'week' | 'month' | 'year';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
    'Advertising': '#a855f7', // purple-500
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

// Date Helper Functions
const getPeriod = (refDate: Date, type: ViewType): { start: Date; end: Date; label: string } => {
    const date = new Date(refDate);
    let start: Date, end: Date, label: string;

    switch (type) {
        case 'day':
            start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
            label = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            break;
        case 'week':
            const firstDayOfWeek = date.getDate() - date.getDay();
            start = new Date(date.getFullYear(), date.getMonth(), firstDayOfWeek);
            end = new Date(date.getFullYear(), date.getMonth(), firstDayOfWeek + 6, 23, 59, 59, 999);
            label = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
            break;
        case 'year':
            start = new Date(date.getFullYear(), 0, 1);
            end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
            label = date.getFullYear().toString();
            break;
        case 'month':
        default:
            start = new Date(date.getFullYear(), date.getMonth(), 1);
            end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            break;
    }
    return { start, end, label };
};

const getPreviousPeriodStart = (refDate: Date, type: ViewType): Date => {
    const prevDate = new Date(refDate);
    switch (type) {
        case 'day': prevDate.setDate(prevDate.getDate() - 1); break;
        case 'week': prevDate.setDate(prevDate.getDate() - 7); break;
        case 'year': prevDate.setFullYear(prevDate.getFullYear() - 1); break;
        case 'month': default: prevDate.setMonth(prevDate.getMonth() - 1); break;
    }
    return prevDate;
};


const ComparisonStatCard: React.FC<{ title: string; value: number; change: number; positiveIsGood: boolean; periodLabel: string }> = 
({ title, value, change, positiveIsGood, periodLabel }) => {
    const isPositive = change >= 0;
    const isNeutral = !isFinite(change) || Math.abs(change) < 0.1;

    let colorClass = 'text-slate-500 dark:text-slate-400';
    if (!isNeutral) {
        if (isPositive) colorClass = positiveIsGood ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
        else colorClass = positiveIsGood ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500';
    }
    
    const changeText = isNeutral 
        ? 'vs previous period' 
        : `${isPositive ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}% vs. previous ${periodLabel}`;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
            <p className="text-4xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p className={`text-sm font-medium mt-1 ${colorClass}`}>
                {changeText}
            </p>
        </div>
    );
};

const ReportsView: React.FC = () => {
    const { expenses, bankTransactions } = useFinance();
    const { mileageLogs } = useMileage();
    const { businessInfo } = useApp();
    const [viewType, setViewType] = useState<ViewType>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [exportStartDate, setExportStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return getIsoDate(d);
    });
    const [exportEndDate, setExportEndDate] = useState(getIsoDate(new Date()));

    const { current, previous, changes, periodLabel, periodTypeLabel } = useMemo(() => {
        const calculateMetrics = (start: Date, end: Date) => {
            const inDateRange = (dateStr: string) => {
                const date = new Date(dateStr + 'T00:00:00');
                return date >= start && date <= end;
            };

            const income = bankTransactions.filter(t => t.amount > 0 && inDateRange(t.date)).reduce((sum, t) => sum + t.amount, 0);

            let totalExpenses = 0;
            const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};
            const reconciledExpenses = expenses.filter(e => e.isReconciled && e.bankTransactionIds?.length && inDateRange(e.date));

            for (const exp of reconciledExpenses) {
                totalExpenses += exp.total;
                for (const item of exp.lineItems) {
                    expensesByCategory[item.category] = (expensesByCategory[item.category] || 0) + item.amount;
                }
                if (exp.tax > 0 && exp.lineItems.length > 0) {
                    expensesByCategory[exp.lineItems[0].category] = (expensesByCategory[exp.lineItems[0].category] || 0) + exp.tax;
                }
                const bankTxn = bankTransactions.find(t => exp.bankTransactionIds?.includes(t.id));
                if (bankTxn) {
                    const fee = exp.total - Math.abs(bankTxn.amount);
                    if (fee > 0.01) expensesByCategory['Bank & Processing Fee'] = (expensesByCategory['Bank & Processing Fee'] || 0) + fee;
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
            const totalMileageCost = mileageLogs.filter(log => inDateRange(log.date)).reduce((sum, log) => sum + (log.distance * mileageRate), 0);
            if (totalMileageCost > 0) {
                totalExpenses += totalMileageCost;
                expensesByCategory['Mileage'] = (expensesByCategory['Mileage'] || 0) + totalMileageCost;
            }

            const netProfit = income - totalExpenses;
            const expenseChartData = Object.entries(expensesByCategory).filter(([, value]) => value > 0).map(([label, value]) => ({
                label: label as ExpenseCategory, value, color: CATEGORY_COLORS[label as ExpenseCategory] || '#a3a3a3'
            })).sort((a,b) => b.value - a.value);

            return { income, totalExpenses, netProfit, expenseChartData };
        };

        const currentPeriod = getPeriod(currentDate, viewType);
        const prevDate = getPreviousPeriodStart(currentDate, viewType);
        const previousPeriod = getPeriod(prevDate, viewType);

        const currentMetrics = calculateMetrics(currentPeriod.start, currentPeriod.end);
        const previousMetrics = calculateMetrics(previousPeriod.start, previousPeriod.end);

        const calcChange = (currentVal: number, prevVal: number) => {
            if (prevVal === 0) return currentVal > 0 ? Infinity : 0;
            return ((currentVal - prevVal) / Math.abs(prevVal)) * 100;
        };
        const changes = {
            income: calcChange(currentMetrics.income, previousMetrics.income),
            expenses: calcChange(currentMetrics.totalExpenses, previousMetrics.totalExpenses),
            profit: calcChange(currentMetrics.netProfit, previousMetrics.netProfit),
        };

        return { current: currentMetrics, previous: previousMetrics, changes, periodLabel: currentPeriod.label, periodTypeLabel: viewType };
    }, [viewType, currentDate, expenses, bankTransactions, mileageLogs, businessInfo]);
    
    const handleNav = (direction: 'prev' | 'next' | 'today') => {
        const newDate = new Date(currentDate);
        if (direction === 'today') {
            setCurrentDate(new Date());
            return;
        }
        const increment = direction === 'prev' ? -1 : 1;
        switch (viewType) {
            case 'day': newDate.setDate(newDate.getDate() + increment); break;
            case 'week': newDate.setDate(newDate.getDate() + 7 * increment); break;
            case 'year': newDate.setFullYear(newDate.getFullYear() + increment); break;
            case 'month': default: newDate.setMonth(newDate.getMonth() + increment); break;
        }
        setCurrentDate(newDate);
    };

    const handleExportMileage = () => {
        const start = new Date(exportStartDate + 'T00:00:00');
        const end = new Date(exportEndDate + 'T23:59:59');

        const filteredLogs = mileageLogs.filter(log => {
            const logDate = new Date(log.date + 'T00:00:00');
            return logDate >= start && logDate <= end;
        });

        if (filteredLogs.length === 0) {
            alert("No mileage data in the selected date range.");
            return;
        }

        const dataToExport = filteredLogs.map(log => ({
            Date: log.date,
            'Start Address': log.startAddress,
            'End Address': log.endAddress,
            'Distance (mi)': log.distance,
            Notes: log.notes || '',
            'Deduction': (log.distance * (businessInfo.standardMileageRate || 0)).toFixed(2),
            'Linked Job ID': log.jobId || '',
        }));

        exportToCsv(dataToExport, `mileage_log_${exportStartDate}_to_${exportEndDate}.csv`);
    };
    
    const handleExportExpenses = () => {
        const start = new Date(exportStartDate + 'T00:00:00');
        const end = new Date(exportEndDate + 'T23:59:59');

        const filteredExpenses = expenses.filter(exp => {
            const expDate = new Date(exp.date + 'T00:00:00');
            return expDate >= start && expDate <= end;
        });

        if (filteredExpenses.length === 0) {
            alert("No expense data in the selected date range.");
            return;
        }
        
        const dataToExport = filteredExpenses.flatMap(exp => {
            if (exp.lineItems.length > 0) {
                return exp.lineItems.map(item => ({
                    Date: exp.date,
                    Vendor: exp.vendor,
                    'Expense ID': exp.id,
                    'Item Description': item.description,
                    Category: item.category,
                    Amount: item.amount.toFixed(2),
                    'Expense Total': exp.total.toFixed(2),
                    Reconciled: exp.isReconciled ? 'Yes' : 'No',
                }));
            }
            return [{
                Date: exp.date,
                Vendor: exp.vendor,
                'Expense ID': exp.id,
                'Item Description': 'N/A',
                Category: 'Uncategorized',
                Amount: exp.total.toFixed(2),
                'Expense Total': exp.total.toFixed(2),
                Reconciled: exp.isReconciled ? 'Yes' : 'No',
            }];
        });

        exportToCsv(dataToExport, `expense_report_${exportStartDate}_to_${exportEndDate}.csv`);
    };

    const ViewTypeButton: React.FC<{ type: ViewType, label: string }> = ({ type, label }) => (
        <button onClick={() => setViewType(type)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewType === type ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
            {label}
        </button>
    );
    
    const barChartData = [
        {
            groupLabel: 'Income',
            bars: [
                { label: 'Current', value: current.income, color: '#16a34a' }, // green-600
                { label: 'Previous', value: previous.income, color: '#86efac' }, // green-300
            ]
        },
        {
            groupLabel: 'Expenses',
            bars: [
                { label: 'Current', value: current.totalExpenses, color: '#dc2626' }, // red-600
                { label: 'Previous', value: previous.totalExpenses, color: '#fca5a5' }, // red-300
            ]
        }
    ];

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                     <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Financial Reports</h1>
                    <div className="flex items-center justify-center space-x-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                        <ViewTypeButton type="day" label="Daily" />
                        <ViewTypeButton type="week" label="Weekly" />
                        <ViewTypeButton type="month" label="Monthly" />
                        <ViewTypeButton type="year" label="Yearly" />
                    </div>
                </div>
                 <div className="mt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <p className="font-semibold text-lg text-slate-700 dark:text-slate-200 text-center sm:text-left">{periodLabel}</p>
                    <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => handleNav('prev')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeftIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleNav('today')} className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600">Today</button>
                        <button onClick={() => handleNav('next')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRightIcon className="w-5 h-5"/></button>
                    </div>
                </div>
            </div>
             <div className="p-4 sm:p-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ComparisonStatCard title="Total Income" value={current.income} change={changes.income} positiveIsGood={true} periodLabel={periodTypeLabel} />
                    <ComparisonStatCard title="Total Expenses" value={current.totalExpenses} change={changes.expenses} positiveIsGood={false} periodLabel={periodTypeLabel} />
                    <ComparisonStatCard title="Net Profit" value={current.netProfit} change={changes.profit} positiveIsGood={true} periodLabel={periodTypeLabel} />
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Period Comparison</h2>
                    <BarChart data={barChartData}/>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Expense Breakdown</h2>
                    <DonutChart data={current.expenseChartData} />
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
