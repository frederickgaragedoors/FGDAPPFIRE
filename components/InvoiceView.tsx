
import React, { useState, useRef } from 'react';
import { Contact, JobTicket, BusinessInfo, FileAttachment, EmailSettings } from '../types.ts';
import { ArrowLeftIcon, MailIcon, ShareIcon } from './icons.tsx';
import { generateId, fileToDataUrl, calculateJobTicketTotal, processTemplate, formatPhoneNumber } from '../utils.ts';
import { generatePdf } from '../services/pdfGenerator.ts';

interface InvoiceViewProps {
    contact: Contact;
    ticket: JobTicket;
    businessInfo: BusinessInfo;
    emailSettings: EmailSettings;
    onClose: () => void;
    addFilesToContact: (contactId: string, files: FileAttachment[]) => void;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ contact, ticket, businessInfo, emailSettings, onClose, addFilesToContact }) => {
    const [docType, setDocType] = useState<'receipt' | 'estimate'>('receipt');
    const [isSaving, setIsSaving] = useState(false);
    const invoiceContentRef = useRef<HTMLDivElement>(null);

    // --- Calculations ---
    const { subtotal, taxAmount, feeAmount, totalCost, deposit, balanceDue } = calculateJobTicketTotal(ticket);
    
    const cashTotal = subtotal + taxAmount;
    const cardTotal = totalCost; 
    const depositRatio = totalCost > 0 ? deposit / totalCost : 0;
    
    const cardDeposit = deposit; 
    const cardBalance = cardTotal - cardDeposit;
    
    const cashDeposit = cashTotal * depositRatio;
    const cashBalance = cashTotal - cashDeposit;

    const isNativeShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

    const paymentStatus = ticket.paymentStatus || 'unpaid';
    
    let displayTitle = docType.toUpperCase();
    if (docType === 'receipt') {
        if (paymentStatus === 'paid_in_full') {
            displayTitle = 'FINAL RECEIPT';
        } else if (paymentStatus === 'deposit_paid') {
            displayTitle = 'DEPOSIT RECEIPT';
        } else {
            displayTitle = 'INVOICE';
        }
    }
    
    const hasInspectionResults = (ticket.inspection || []).some(i => 
        i.status === 'Pass' || i.status === 'Fail' || i.status === 'Repaired'
    );

    const handleDownload = async () => {
        if (isSaving) return;
        setIsSaving(true);
        const result = await generatePdf({ contact, ticket, businessInfo, docType });
        if (result) {
            result.pdf.save(result.fileName);
        }
        setIsSaving(false);
    };

    const handleAttach = async () => {
        if (isSaving) return;
        setIsSaving(true);
        const result = await generatePdf({ contact, ticket, businessInfo, docType });
        if (result) {
            const { pdf, fileName } = result;
            const pdfBlob = pdf.output('blob');
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
            
            try {
                 const dataUrl = await fileToDataUrl(pdfFile);
                 const newFileAttachment = {
                    id: generateId(),
                    name: fileName,
                    type: 'application/pdf',
                    size: pdfFile.size,
                    dataUrl: dataUrl
                };
                await addFilesToContact(contact.id, [newFileAttachment]);
                alert('PDF attached successfully!');
            } catch (error) {
                console.error("Error attaching PDF:", error);
                alert("Failed to attach PDF.");
            }
        }
        setIsSaving(false);
    };
    
    const handleEmail = async () => {
        if (isSaving) return;
        setIsSaving(true);

        const template = docType === 'estimate' ? emailSettings.estimate : emailSettings.receipt;
        
        const templateData = {
            customerName: contact.name,
            jobId: ticket.id,
            businessName: businessInfo.name || 'Our Company',
            date: new Date().toLocaleDateString()
        };

        const subject = processTemplate(template.subject, templateData);
        const body = processTemplate(template.body, templateData);
        
        const result = await generatePdf({ contact, ticket, businessInfo, docType });
        
        if (result) {
            result.pdf.save(result.fileName);

            setTimeout(() => {
                const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.location.href = mailtoLink;
                alert("PDF downloaded. Opening email client... Please attach the PDF file to your email.");
            }, 500);
        }
        setIsSaving(false);
    };

    const handleNativeShare = async () => {
        if (isSaving) return;
        setIsSaving(true);

        const template = docType === 'estimate' ? emailSettings.estimate : emailSettings.receipt;

        const templateData = {
            customerName: contact.name,
            jobId: ticket.id,
            businessName: businessInfo.name || 'Our Company',
            date: new Date().toLocaleDateString()
        };
        
        const subject = processTemplate(template.subject, templateData);
        const body = processTemplate(template.body, templateData);

        try {
             const result = await generatePdf({ contact, ticket, businessInfo, docType });
             if (!result) throw new Error("Failed to generate PDF");
             
             const pdfBlob = result.pdf.output('blob');
             const file = new File([pdfBlob], result.fileName, { type: 'application/pdf' });

             if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                 await navigator.share({
                     files: [file],
                     title: subject,
                     text: body,
                 });
             } else {
                 alert("Sharing files is not supported on this device. Please use the Email or Download option.");
             }
        } catch (error) {
            console.error("Share failed:", error);
             if (error.name !== 'AbortError') {
                alert("Share failed. Please try downloading or using the Email button.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-200 dark:bg-slate-900 overflow-y-auto print:bg-white print:overflow-visible print:h-auto">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-invoice, #printable-invoice * {
                        visibility: visible;
                    }
                    #printable-invoice {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0 !important;
                        padding: 20mm !important;
                        box-shadow: none !important;
                    }
                    @page {
                        size: auto;
                        margin: 0mm;
                    }
                    html, body, #root {
                        height: auto !important;
                        overflow: visible !important;
                    }
                }
            `}</style>
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 print:hidden">
                <div className="flex flex-col xl:flex-row items-center xl:justify-between gap-4 xl:gap-0">
                    <div className="w-full xl:w-auto flex items-center justify-center xl:justify-start relative">
                        <button onClick={onClose} className="absolute left-0 xl:static p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                            <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div className="flex items-center justify-center w-full xl:w-auto">
                            <div className="flex items-center space-x-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg sm:ml-4">
                                <button
                                    onClick={() => setDocType('estimate')}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${docType === 'estimate' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                >
                                    Estimate
                                </button>
                                <button
                                    onClick={() => setDocType('receipt')}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${docType === 'receipt' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                >
                                    Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-full xl:w-auto flex flex-wrap items-center justify-center xl:justify-end gap-2">
                        <button 
                             onClick={handleEmail}
                             disabled={isSaving}
                             className="px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-wait flex items-center space-x-2"
                             title="Generate PDF and open email draft"
                        >
                             <MailIcon className="w-4 h-4" />
                             <span>{isSaving ? '...' : 'Email'}</span>
                        </button>
                         {isNativeShareSupported && (
                            <button 
                                onClick={handleNativeShare}
                                disabled={isSaving}
                                className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait flex items-center space-x-2"
                                title="Share PDF file"
                            >
                                <ShareIcon className="w-4 h-4" />
                                <span>Share</span>
                            </button>
                        )}
                        <button 
                            onClick={() => window.print()}
                            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                        >
                            Print
                        </button>
                        <button 
                            onClick={handleDownload}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSaving ? '...' : 'Download'}
                        </button>
                        <button 
                            onClick={handleAttach}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSaving ? '...' : 'Attach'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Invoice Paper */}
            <div className="p-4 md:p-8 flex-grow print:p-0">
                <div id="printable-invoice" ref={invoiceContentRef} className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-lg print:shadow-none invoice-paper">
                    <header className="flex flex-col md:flex-row justify-between items-start pb-6 border-b border-slate-200 text-slate-800">
                         {/* Left: Logo (First in visual order for mobile usually, but here we use order classes) */}
                        <div className="w-full md:w-1/3 flex justify-center md:justify-start order-1">
                            {businessInfo.logoUrl && (
                                <img src={businessInfo.logoUrl} alt="Business Logo" className="max-h-24 max-w-[150px] object-contain" />
                            )}
                        </div>

                        {/* Center: Business Info */}
                        <div className="w-full md:w-1/3 text-left md:pl-4 order-2 mt-4 md:mt-0">
                            <h1 className="text-xl font-bold break-words">{businessInfo.name || 'Your Company'}</h1>
                            <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                                <p className="whitespace-pre-line break-words">{businessInfo.address}</p>
                                <p className="break-words">{businessInfo.phone}</p>
                                <p className="break-words">{businessInfo.email}</p>
                            </div>
                        </div>

                        {/* Right: Doc Info */}
                        <div className="w-full md:w-1/3 text-right order-3 mt-4 md:mt-0">
                            <h2 className="text-3xl uppercase font-bold text-slate-700">{displayTitle}</h2>
                            <div className="text-sm text-slate-500 mt-2 space-y-1">
                                <p>
                                    <span className="font-semibold text-slate-600">Job ID:</span> {ticket.id}
                                </p>
                                <p>
                                    <span className="font-semibold text-slate-600">Date:</span> {new Date(ticket.date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </header>

                    <section className="mt-8 flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold uppercase text-slate-500">Bill To</h3>
                            <div className="mt-2 text-slate-700 min-w-0">
                                <p className="font-bold break-words">{contact.name}</p>
                                <p className="text-sm whitespace-pre-line break-words">{contact.address}</p>
                                <p className="text-sm break-words">{contact.phone}</p>
                                <p className="text-sm break-words">{contact.email}</p>
                            </div>
                        </div>
                        {ticket.jobLocation && ticket.jobLocation !== contact.address && (
                             <div className="flex-1">
                                <h3 className="text-sm font-semibold uppercase text-slate-500">Service Location</h3>
                                <div className="mt-2 text-slate-700 min-w-0">
                                    <p className="font-bold break-words">{ticket.jobLocationContactName || contact.name}</p>
                                    <p className="text-sm whitespace-pre-line break-words">{ticket.jobLocation}</p>
                                    {ticket.jobLocationContactPhone && <p className="text-sm break-words">{formatPhoneNumber(ticket.jobLocationContactPhone)}</p>}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="mt-8">
                        <table className="w-full text-left table-fixed">
                            <thead>
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-slate-600 uppercase border-b-2 border-slate-200 w-1/2">Description</th>
                                    <th className="p-3 text-center text-sm font-semibold text-slate-600 uppercase border-b-2 border-slate-200 w-[15%]">Qty</th>
                                    <th className="p-3 text-right text-sm font-semibold text-slate-600 uppercase border-b-2 border-slate-200 w-[20%]">Unit Price</th>
                                    <th className="p-3 text-right text-sm font-semibold text-slate-600 uppercase border-b-2 border-slate-200 w-[20%]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticket.parts.map(part => (
                                    <tr key={part.id} className="border-b border-slate-100">
                                        <td className="p-3 text-sm text-slate-700 break-words">{part.name}</td>
                                        <td className="p-3 text-center text-sm text-slate-700">{part.quantity}</td>
                                        <td className="p-3 text-right text-sm text-slate-700">${part.cost.toFixed(2)}</td>
                                        <td className="p-3 text-right text-sm text-slate-700">${(part.cost * part.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                                 <tr className="border-b border-slate-100">
                                    <td className="p-3 text-sm text-slate-700" colSpan={3}>Labor</td>
                                    <td className="p-3 text-right text-sm text-slate-700">${ticket.laborCost.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <section className="mt-6 flex flex-col items-end">
                       {docType === 'estimate' && (ticket.processingFeeRate || 0) > 0 ? (
                           <div className="w-full mt-4">
                                <div className="w-full max-w-sm ml-auto space-y-2 text-slate-700 border-b border-slate-200 pb-4 mb-6">
                                    <div className="flex justify-between pb-2">
                                        <span className="text-sm font-medium text-slate-600">Subtotal</span>
                                        <span className="text-sm font-medium">${subtotal.toFixed(2)}</span>
                                    </div>
                                    {(ticket.salesTaxRate || 0) > 0 && (
                                        <div className="flex justify-between pb-2">
                                            <span className="text-sm font-medium text-slate-600">Sales Tax ({ticket.salesTaxRate}%)</span>
                                            <span className="text-sm font-medium">${taxAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <h4 className="text-center font-bold text-lg text-slate-800 mb-4 uppercase tracking-wide">Payment Options</h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Cash/Check Option */}
                                    <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                                        <h5 className="font-bold text-slate-700 text-center border-b border-slate-200 pb-2 mb-3">Cash / Check</h5>
                                        <div className="space-y-2 text-sm">
                                            {deposit > 0 ? (
                                                <>
                                                    <div className="flex justify-between text-slate-700">
                                                        <span className="font-medium">Required Deposit (30%)</span>
                                                        <span className="font-medium">${cashDeposit.toFixed(2)}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between text-slate-500 mt-2">
                                                        <span>Balance Due (70%)</span>
                                                        <span>${cashBalance.toFixed(2)}</span>
                                                    </div>

                                                    <div className="flex justify-between items-end border-t border-slate-200 pt-2 mt-4">
                                                        <span className="text-slate-600 font-bold">Total</span>
                                                        <span className="font-bold text-lg text-slate-800">${cashTotal.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex justify-between items-end">
                                                    <span className="text-slate-600">Total</span>
                                                    <span className="font-bold text-lg text-slate-800">${cashTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Option */}
                                    <div className="border-2 border-sky-100 rounded-lg p-4 bg-sky-50">
                                        <h5 className="font-bold text-slate-700 text-center border-b border-sky-200 pb-2 mb-3">Card Payment</h5>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-slate-500">
                                                <span>Processing Fee ({ticket.processingFeeRate}%)</span>
                                                <span>${feeAmount.toFixed(2)}</span>
                                            </div>

                                            {deposit > 0 ? (
                                                <>
                                                    <div className="border-b border-sky-200 my-2"></div>

                                                    <div className="flex justify-between text-slate-700">
                                                        <span className="font-medium">Required Deposit (30%)</span>
                                                        <span className="font-medium">${cardDeposit.toFixed(2)}</span>
                                                    </div>

                                                    <div className="flex justify-between text-slate-500 mt-2">
                                                        <span>Balance Due (70%)</span>
                                                        <span>${cardBalance.toFixed(2)}</span>
                                                    </div>

                                                    <div className="flex justify-between items-end border-t border-sky-200 pt-2 mt-4">
                                                        <span className="text-slate-700 font-bold">Total</span>
                                                        <span className="font-bold text-lg text-slate-800">${cardTotal.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Job Total</span>
                                                        <span className="text-slate-800">${cashTotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end border-t border-sky-200 pt-1 mt-1">
                                                        <span className="text-slate-700 font-medium">Total</span>
                                                        <span className="font-bold text-lg text-slate-800">${cardTotal.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                           </div>
                       ) : (
                            <div className="w-full max-w-xs space-y-2 text-slate-700">
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span className="text-sm font-medium text-slate-600">Subtotal</span>
                                    <span className="text-sm font-medium">${subtotal.toFixed(2)}</span>
                                </div>
                                {(ticket.salesTaxRate || 0) > 0 && (
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-sm font-medium text-slate-600">Sales Tax ({ticket.salesTaxRate}%)</span>
                                        <span className="text-sm font-medium">${taxAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                {(ticket.processingFeeRate || 0) > 0 && (
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-sm font-medium text-slate-600">Card Processing Fee ({ticket.processingFeeRate}%)</span>
                                        <span className="text-sm font-medium">${feeAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                 <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-300">
                                    <span className="text-base font-bold text-slate-800">Total</span>
                                    <span className="text-base font-bold text-slate-800">${totalCost.toFixed(2)}</span>
                                </div>
                                
                                {/* Logic for Receipt vs Estimate Totals */}
                                {docType === 'estimate' ? (
                                    deposit > 0 && (
                                        <div className="flex justify-between py-2 border-t text-slate-800 font-semibold bg-slate-50 px-2 -mx-2 rounded">
                                            <span>Required Deposit (30%)</span>
                                            <span>${deposit.toFixed(2)}</span>
                                        </div>
                                    )
                                ) : (
                                    // Receipt Mode logic
                                    <>
                                        {paymentStatus === 'paid_in_full' ? (
                                            <>
                                                <div className="flex justify-between py-2 border-b border-slate-100 text-green-600 font-bold">
                                                    <span>Amount Paid</span>
                                                    <span>-${totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-3 border-t border-slate-300">
                                                    <span className="text-base font-bold text-slate-800">Balance Due</span>
                                                    <span className="text-base font-bold text-slate-800">$0.00</span>
                                                </div>
                                            </>
                                        ) : paymentStatus === 'deposit_paid' && deposit > 0 ? (
                                             <>
                                                <div className="flex justify-between py-2 border-b border-slate-100 text-green-600">
                                                    <span className="text-sm font-medium">Deposit Paid</span>
                                                    <span className="text-sm font-medium">-${deposit.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-3 border-t border-slate-300">
                                                    <span className="text-base font-bold text-slate-800">Balance Due</span>
                                                    <span className="text-base font-bold text-slate-800">${balanceDue.toFixed(2)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            // Unpaid receipt
                                            <div className="flex justify-between py-3 border-t border-slate-300">
                                                <span className="text-base font-bold text-slate-800">Balance Due</span>
                                                <span className="text-base font-bold text-slate-800">${totalCost.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                       )}
                    </section>

                     {docType === 'estimate' && deposit > 0 && (
                        <section className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Payment Schedule</h3>
                            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                <li>A deposit is due at contract signing to schedule the work.</li>
                                <li>The remaining balance is due upon completion of the job.</li>
                            </ul>
                        </section>
                     )}

                     {hasInspectionResults && (
                        <section className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">25-Point Safety Inspection Summary</h3>
                            
                            <div className="text-sm">
                                {(() => {
                                    const failedOrRepaired = ticket.inspection.filter(i => i.status === 'Fail' || i.status === 'Repaired');
                                    const passedCount = ticket.inspection.filter(i => i.status === 'Pass').length;
                                    
                                    return (
                                        <>
                                            {failedOrRepaired.length > 0 && (
                                                <table className="w-full text-left border-collapse mb-4">
                                                    <thead>
                                                        <tr className="bg-red-50 text-red-800">
                                                            <th className="p-2 border border-red-100 w-1/2">Item</th>
                                                            <th className="p-2 border border-red-100 w-1/4">Status</th>
                                                            <th className="p-2 border border-red-100 w-1/4">Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {failedOrRepaired.map(item => (
                                                            <tr key={item.id}>
                                                                <td className="p-2 border border-slate-200 text-slate-700">{item.name}</td>
                                                                <td className={`p-2 border border-slate-200 font-bold ${item.status === 'Fail' ? 'text-red-600' : 'text-blue-600'}`}>{item.status}</td>
                                                                <td className="p-2 border border-slate-200 text-slate-500 italic">{item.notes || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                            {passedCount > 0 && (
                                                <p className="text-slate-600">
                                                    <span className="font-bold text-green-600">{passedCount}</span> additional items passed safety inspection.
                                                </p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </section>
                     )}
                    
                    <footer className="mt-12 pt-8 border-t text-center">
                        <p className="text-sm text-slate-500">Thank you for your business!</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default InvoiceView;
