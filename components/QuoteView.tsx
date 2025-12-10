import React, { useState, useEffect, useRef } from 'react';
import { Contact, Quote, QuoteOption, JobTicket } from '../types.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { ArrowLeftIcon, MailIcon, ShareIcon, PrinterIcon, DownloadIcon, CheckCircleIcon, FileIcon } from './icons.tsx';
import { generateId, fileToDataUrl } from '../utils.ts';
import { generateQuotePdf } from '../services/quotePdfGenerator.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface QuoteViewProps {
    contactId: string;
    quoteId: string;
    onClose: () => void;
}

const QuoteView: React.FC<QuoteViewProps> = ({ contactId, quoteId, onClose }) => {
    const { contacts, handleSaveQuote, handleUpdateContactJobTickets, handleAddFilesToContact } = useContacts();
    const { businessInfo, emailSettings } = useApp();
    const [isSaving, setIsSaving] = useState(false);
    const [optionToConvert, setOptionToConvert] = useState<QuoteOption | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const contact = contacts.find(c => c.id === contactId);
    const quote = contact?.quotes?.find(q => q.id === quoteId);
    const isNativeShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

    useEffect(() => {
        let objectUrl: string | null = null;
        
        const generatePreview = async () => {
            if (contact && quote && businessInfo) {
                try {
                    const result = await generateQuotePdf({ contact, quote, businessInfo });
                    if (result) {
                        const pdfBlob = result.pdf.output('blob');
                        objectUrl = URL.createObjectURL(pdfBlob);
                        setPdfUrl(objectUrl);
                    }
                } catch (error) {
                    console.error("Failed to generate PDF preview:", error);
                    setPdfUrl(null); // Clear URL on error
                }
            }
        };

        generatePreview();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [contact, quote, businessInfo]);


    if (!contact || !quote) {
        return <div className="p-4"><p>Could not find the requested quote.</p><button onClick={onClose}>Go Back</button></div>;
    }

    const performPdfAction = async (action: 'download' | 'print' | 'share' | 'email' | 'attach') => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const result = await generateQuotePdf({ contact, quote, businessInfo });
            if (!result) throw new Error("PDF generation failed.");

            const { pdf, fileName } = result;

            if (action === 'download') {
                pdf.save(fileName);
            } else if (action === 'print') {
                const pdfBlob = pdf.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                window.open(pdfUrl, '_blank');
            } else if (action === 'attach') {
                const pdfBlob = pdf.output('blob');
                const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
                const dataUrl = await fileToDataUrl(pdfFile);
                await handleAddFilesToContact(contact.id, [{ id: generateId(), name: fileName, type: 'application/pdf', size: pdfFile.size, dataUrl }], { [generateId()]: pdfFile });
            } else if (action === 'share' && isNativeShareSupported) {
                const pdfBlob = pdf.output('blob');
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: quote.title });
                }
            } else if (action === 'email') {
                // Email action combines download with mailto link
                pdf.save(fileName);
                setTimeout(() => {
                    const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(quote.title)}`;
                    window.location.href = mailto;
                }, 500);
            }
        } catch (error) {
            console.error(`PDF action '${action}' failed:`, error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const convertToJob = () => {
        if (!optionToConvert) return;
        
        const newJob: Omit<JobTicket, 'id'> = {
            createdAt: new Date().toISOString(),
            statusHistory: [{
                id: generateId(),
                status: 'Scheduled',
                timestamp: new Date().toISOString(),
                notes: `Converted from Quote #${quote.quoteNumber}, Option: ${optionToConvert.name}`
            }],
            notes: optionToConvert.description,
            parts: optionToConvert.parts,
            laborCost: optionToConvert.laborCost,
            jobLocation: contact.address,
            salesTaxRate: quote.salesTaxRate,
            processingFeeRate: quote.processingFeeRate
        };

        handleUpdateContactJobTickets(contact.id, newJob);
        handleSaveQuote(contact.id, { ...quote, status: 'Accepted' });
        setOptionToConvert(null);
        onClose(); // Go back to contact detail after conversion
    };

    return (
        <>
            <div className="h-full flex flex-col bg-slate-200 dark:bg-slate-900 overflow-y-auto">
                <div className="p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 print:hidden sticky top-0 z-10">
                    <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
                        <div className="w-full sm:w-auto flex items-center">
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 mr-2"><ArrowLeftIcon className="w-6 h-6" /></button>
                            <h1 className="text-xl font-bold truncate">{quote.title}</h1>
                        </div>
                        <div className="w-full sm:w-auto flex flex-wrap items-center justify-center gap-2">
                             <button onClick={() => performPdfAction('print')} className="px-3 py-2 text-sm rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"><PrinterIcon className="w-4 h-4"/></button>
                             <button onClick={() => performPdfAction('download')} className="px-3 py-2 text-sm rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"><DownloadIcon className="w-4 h-4"/></button>
                             {isNativeShareSupported && <button onClick={() => performPdfAction('share')} className="px-3 py-2 text-sm rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"><ShareIcon className="w-4 h-4"/></button>}
                             <button onClick={() => performPdfAction('email')} className="px-4 py-2 text-sm rounded-md bg-sky-500 text-white hover:bg-sky-600 flex items-center gap-2"><MailIcon className="w-4 h-4"/> Email</button>
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-8 flex-grow flex flex-col items-center">
                     {pdfUrl ? (
                        <div className="w-full flex-grow bg-white shadow-lg rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative min-h-[500px]">
                            {/* Desktop: Iframe */}
                            <iframe src={pdfUrl} className="w-full h-full hidden md:block" title="Quote Preview" />
                            
                            {/* Mobile: Native Open Button */}
                            <div className="md:hidden w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-slate-50 dark:bg-slate-800 absolute inset-0">
                                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                                    <FileIcon className="w-10 h-10" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quote PDF Ready</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2">Previewing PDF documents inside the app is limited on mobile devices.</p>
                                </div>
                                <a 
                                    href={pdfUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-6 py-3 bg-sky-500 text-white font-bold rounded-lg shadow-md hover:bg-sky-600 transition-colors flex items-center"
                                >
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    Open PDF Viewer
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-white shadow-lg flex items-center justify-center min-h-[300px]">
                            <p className="text-slate-500">Generating preview...</p>
                        </div>
                    )}
                     <div className="w-full max-w-4xl mx-auto mt-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-3">Accept Quote & Convert to Job</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Select the option the customer approved to automatically create a new job ticket with all the correct details.</p>
                        <div className="space-y-2">
                            {quote.options.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setOptionToConvert(opt)}
                                    className="w-full text-left p-3 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-sky-50 dark:hover:bg-sky-900/50 hover:border-sky-400 dark:hover:border-sky-600 transition-colors flex justify-between items-center"
                                >
                                    <span className="font-medium">{opt.name}</span>
                                    <div className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300 font-semibold">
                                        <CheckCircleIcon className="w-5 h-5"/> Convert
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {optionToConvert && (
                <ConfirmationModal
                    isOpen={!!optionToConvert}
                    onClose={() => setOptionToConvert(null)}
                    onConfirm={convertToJob}
                    title="Convert to Job"
                    message={`Are you sure you want to create a new job from the "${optionToConvert.name}" option? This will also mark the quote as 'Accepted'.`}
                    confirmText="Yes, Convert"
                    confirmButtonClass="bg-sky-600 hover:bg-sky-700"
                />
            )}
        </>
    );
};

export default QuoteView;
