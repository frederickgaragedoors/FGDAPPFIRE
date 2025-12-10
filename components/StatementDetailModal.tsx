import React, { useRef, useState, useMemo } from 'react';
import { BankStatement, BankTransaction } from '../types.ts';
import { XIcon, DownloadIcon, PrinterIcon, SearchIcon } from './icons.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';

interface StatementDetailModalProps {
    statement: BankStatement;
    transactions: BankTransaction[];
    onClose: () => void;
}

const StatementDetailModal: React.FC<StatementDetailModalProps> = ({ statement, transactions, onClose }) => {
    const printableRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { addNotification } = useNotifications();

    const filteredTransactions = useMemo(() => {
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!searchTerm) return sortedTransactions;

        const lowercasedFilter = searchTerm.toLowerCase();
        return sortedTransactions.filter(transaction =>
            transaction.description.toLowerCase().includes(lowercasedFilter)
        );
    }, [searchTerm, transactions]);

    const handleDownloadCsv = () => {
        const headers = ['Date', 'Description', 'Amount'];
        const rows = filteredTransactions.map(t => 
            [t.date, `"${t.description.replace(/"/g, '""')}"`, t.amount]
        );
        let csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${statement.fileName.replace(/\.(pdf|csv)$/i, '')}_transactions.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification("CSV downloaded successfully.", "success");
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Statement Details</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{statement.fileName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto" ref={printableRef}>
                   <div className="printable-area">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{statement.statementPeriod}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Contains {transactions.length} transactions.</p>
                        </div>
                        
                        <div className="px-6 pb-4 no-print">
                             <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="w-5 h-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search descriptions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                />
                            </div>
                        </div>

                        <div className="px-6 pb-6">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Description</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredTransactions.map(t => (
                                        <tr key={t.id}>
                                            <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-slate-600 dark:text-slate-300">{new Date(t.date + 'T00:00:00').toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">{t.description}</td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right whitespace-nowrap ${t.amount > 0 ? 'text-green-600 dark:text-green-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                                {t.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {filteredTransactions.length === 0 && (
                                <p className="text-center p-8 text-slate-500">No matching transactions found.</p>
                            )}
                        </div>
                   </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-between items-center rounded-b-lg border-t dark:border-slate-700 flex-shrink-0 no-print">
                    <div className="flex space-x-2">
                         <button onClick={handleDownloadCsv} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600">
                            <DownloadIcon className="w-4 h-4" /> Download CSV
                        </button>
                         <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600">
                            <PrinterIcon className="w-4 h-4" /> Print
                        </button>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatementDetailModal;