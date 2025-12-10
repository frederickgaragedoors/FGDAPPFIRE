import React, { useState, useEffect } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { ArrowLeftIcon, PrinterIcon, DownloadIcon } from './icons.tsx';
import { generatePdf } from '../services/pdfGenerator.ts';

interface InvoiceViewProps {
    contactId: string;
    ticketId: string;
    from?: 'contact_detail' | 'job_detail';
    onClose: () => void;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ contactId, ticketId, onClose }) => {
    const { contacts } = useContacts();
    const { businessInfo } = useApp();
    const { addNotification } = useNotifications();
    const [isSaving, setIsSaving] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const contact = contacts.find(c => c.id === contactId);
    const ticket = contact?.jobTickets.find(t => t.id === ticketId);

    const paymentStatus = ticket?.paymentStatus || 'unpaid';
    const docType = (paymentStatus === 'paid_in_full' || paymentStatus === 'deposit_paid') ? 'receipt' : 'estimate';

    useEffect(() => {
        let objectUrl: string | null = null;
        const generatePreview = async () => {
            if (contact && ticket && businessInfo) {
                try {
                    const result = await generatePdf({ contact, ticket, businessInfo, docType });
                    if (result) {
                        const pdfBlob = result.pdf.output('blob');
                        objectUrl = URL.createObjectURL(pdfBlob);
                        setPdfUrl(objectUrl);
                    }
                } catch (error) {
                    console.error("Failed to generate PDF preview:", error);
                }
            }
        };
        generatePreview();
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [contact, ticket, businessInfo, docType]);

    if (!contact || !ticket) {
        return <div className="p-4"><p>Job ticket not found.</p><button onClick={onClose}>Go Back</button></div>;
    }

    const handleDownload = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const result = await generatePdf({ contact, ticket, businessInfo, docType });
            if (result) {
                result.pdf.save(result.fileName);
                addNotification("Document downloaded successfully.", "success");
            }
        } catch (error) {
            console.error("Failed to download PDF:", error);
            addNotification("Could not generate PDF for download.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = async () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-200 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 mr-2">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold capitalize">{docType} Preview</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-3 py-2 text-sm rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"><PrinterIcon className="w-4 h-4" /></button>
                        <button onClick={handleDownload} disabled={isSaving} className="px-3 py-2 text-sm rounded-md bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"><DownloadIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
            <div className="flex-grow p-4 md:p-8 flex justify-center">
                {pdfUrl ? (
                    <iframe src={pdfUrl} className="w-full max-w-4xl h-full min-h-[500px] shadow-lg rounded-lg bg-white" title="PDF Preview" />
                ) : (
                    <div className="flex items-center justify-center text-slate-500">Generating preview...</div>
                )}
            </div>
        </div>
    );
};

export default InvoiceView;