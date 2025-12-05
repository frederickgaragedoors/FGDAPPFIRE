import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Contact, Quote, BusinessInfo, SafetyInspection } from '../types.ts';
import { calculateQuoteOptionTotal } from '../utils.ts';

interface GenerateQuotePdfParams {
    contact: Contact;
    quote: Quote;
    businessInfo: BusinessInfo;
}

const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        if (src.startsWith('http')) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
};

export const generateQuotePdf = async ({ contact, quote, businessInfo }: GenerateQuotePdfParams) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const bottomMargin = 50;
    let yPos = 40;

    const checkAndAddPage = (currentY: number, requiredSpace: number): number => {
        if (currentY + requiredSpace > pageHeight - bottomMargin) {
            doc.addPage();
            return margin;
        }
        return currentY;
    };

    // --- Header ---
    const logoSource = businessInfo.logoDataUrl || businessInfo.logoUrl;
    const loadedLogo = logoSource ? await loadImageElement(logoSource) : null;
    if (loadedLogo) {
        const aspectRatio = loadedLogo.width / loadedLogo.height;
        let w = 80; let h = 80 / aspectRatio;
        if (h > 60) { h = 60; w = h * aspectRatio; }
        doc.addImage(loadedLogo, 'PNG', margin, yPos, w, h);
    }
    
    doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b'); // slate-800
    doc.text(quote.title, pageWidth / 2, yPos + 20, { align: 'center' });

    const rightColX = pageWidth - margin;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#64748b'); // slate-500
    doc.text(`Quote #: ${quote.quoteNumber}`, rightColX, yPos + 10, { align: 'right' });
    doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, rightColX, yPos + 25, { align: 'right' });
    yPos = Math.max(yPos + (loadedLogo ? 60 : 0), yPos + 40) + 20;
    
    doc.setDrawColor('#e2e8f0'); doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 25;

    // --- Bill To & Business Info ---
    const halfWidth = (pageWidth / 2) - margin;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor('#64748b');
    doc.text('PREPARED FOR', margin, yPos);
    doc.text('PREPARED BY', halfWidth + margin + 20, yPos);
    yPos += 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
    doc.text(contact.name, margin, yPos);
    doc.text(businessInfo.name, halfWidth + margin + 20, yPos);
    yPos += 14;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569'); // slate-600
    doc.text(contact.address || '', margin, yPos, { maxWidth: halfWidth });
    doc.text(businessInfo.address || '', halfWidth + margin + 20, yPos, { maxWidth: halfWidth });
    const contactAddressLines = doc.splitTextToSize(contact.address || '', halfWidth).length;
    const businessAddressLines = doc.splitTextToSize(businessInfo.address || '', halfWidth).length;
    yPos += Math.max(contactAddressLines, businessAddressLines) * 11 + 5;
    if(contact.phone) doc.text(contact.phone, margin, yPos);
    if(businessInfo.phone) doc.text(String(businessInfo.phone), halfWidth + margin + 20, yPos);
    yPos += 12;
    if(contact.email) doc.text(contact.email, margin, yPos);
    if(businessInfo.email) doc.text(businessInfo.email, halfWidth + margin + 20, yPos);
    yPos += 30;

    // --- Adaptive Layout Logic ---
    const numOptions = quote.options.length;

    if (numOptions === 1) {
        // --- Single Column Layout ---
        const option = quote.options[0];
        const { subtotal, taxAmount, cashTotal, feeAmount, totalCost } = calculateQuoteOptionTotal(option, quote.salesTaxRate, quote.processingFeeRate);
        const cashDeposit = cashTotal * 0.30;
        const cashBalance = cashTotal - cashDeposit;
        const cardDeposit = totalCost * 0.30;
        const cardBalance = totalCost - cardDeposit;
        
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
        doc.text(option.name, margin, yPos);
        yPos += 20;

        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
        const descLines = doc.splitTextToSize(option.description, pageWidth - margin * 2);
        doc.text(descLines, margin, yPos);
        yPos += descLines.length * 12 + 15;

        autoTable(doc, {
            startY: yPos,
            head: [[
                { content: 'Description', styles: { halign: 'left' } },
                { content: 'Qty', styles: { halign: 'center' } },
                { content: 'Amount', styles: { halign: 'right' } }
            ]],
            body: option.parts.map(p => [p.name, p.quantity.toString(), `$${(p.cost * p.quantity).toFixed(2)}`]),
            theme: 'plain',
            headStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
            columnStyles: { 
                1: { halign: 'center' }, 
                2: { halign: 'right' } 
            }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;

        // --- Totals Section ---
        yPos = checkAndAddPage(yPos, 220);
        
        let totalsX = pageWidth - margin - 200;
        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
        doc.text('Subtotal', totalsX, yPos); doc.text(`$${subtotal.toFixed(2)}`, rightColX, yPos, { align: 'right' }); yPos += 18;
        if (taxAmount > 0) {
            doc.text(`Sales Tax (${quote.salesTaxRate}%)`, totalsX, yPos); doc.text(`$${taxAmount.toFixed(2)}`, rightColX, yPos, { align: 'right' }); yPos += 18;
        }
        yPos += 10;
        doc.setDrawColor('#e2e8f0');
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 20;
        
        // --- Cash/Check Total Box ---
        const cashBoxY = yPos;
        const cashBoxHeight = 65;
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(margin, cashBoxY, pageWidth - margin * 2, cashBoxHeight, 10, 10, 'FD');

        const cashLineY = cashBoxY + 30;

        // "Cash/Check Total" text just above the line
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
        doc.text('Cash/Check Total', margin + 20, cashLineY - 5);
        
        // Draw the line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(margin + 20, cashLineY, pageWidth - margin - 20, cashLineY);

        // Deposit/Balance and Final Total just below the line
        const cashFinalTotalY = cashLineY + 20;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
        doc.text(`Deposit: $${cashDeposit.toFixed(2)} | Balance: $${cashBalance.toFixed(2)}`, margin + 20, cashFinalTotalY + 2);

        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text(`$${cashTotal.toFixed(2)}`, pageWidth - margin - 20, cashFinalTotalY, { align: 'right' });
        
        yPos = cashBoxY + cashBoxHeight + 10;

        // --- Card Total Box ---
        const cardBoxY = yPos;
        const cardBoxHeight = 85;
        doc.setFillColor(240, 249, 255); // sky-50
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.roundedRect(margin, cardBoxY, pageWidth - margin * 2, cardBoxHeight, 10, 10, 'FD');

        let cardContentY = cardBoxY + 15;

        // Job Total / Fee on the right, at the very top
        doc.setFontSize(10); doc.setTextColor('#475569'); // slate-600
        doc.text('Job Total:', pageWidth - margin - 120, cardContentY);
        doc.text(`$${cashTotal.toFixed(2)}`, pageWidth - margin - 20, cardContentY, { align: 'right' });
        doc.text(`Card Fee:`, pageWidth - margin - 120, cardContentY + 15);
        doc.text(`+ $${feeAmount.toFixed(2)}`, pageWidth - margin - 20, cardContentY + 15, { align: 'right' });

        const lineY = cardBoxY + 45;

        // "Card Total" text just above the line
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
        doc.text('Card Total', margin + 20, lineY - 5);

        // Draw the line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(margin + 20, lineY, pageWidth - margin - 20, lineY);

        // Deposit/Balance and Final Total just below the line
        const finalTotalY = lineY + 20;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
        doc.text(`Deposit: $${cardDeposit.toFixed(2)} | Balance: $${cardBalance.toFixed(2)}`, margin + 20, finalTotalY + 2);

        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text(`$${totalCost.toFixed(2)}`, pageWidth - margin - 20, finalTotalY, { align: 'right' });

        yPos = cardBoxY + cardBoxHeight + 20;

    } else {
        // --- Multi-column layout ---
        const colWidth = (pageWidth - margin * 2 - (numOptions - 1) * 20) / numOptions;
        let maxY = yPos;

        for (let i = 0; i < numOptions; i++) {
            const colX = margin + i * (colWidth + 20);
            let currentY = yPos;
            const option = quote.options[i];
            
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
            doc.text(option.name, colX, currentY, { maxWidth: colWidth });
            currentY += doc.getTextDimensions(option.name, { maxWidth: colWidth }).h + 5;
            
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
            const descLines = doc.splitTextToSize(option.description, colWidth);
            doc.text(descLines, colX, currentY);
            currentY += descLines.length * 10 + 10;
            
            autoTable(doc, {
                startY: currentY,
                head: [[
                    { content: 'Description', styles: { halign: 'left' } },
                    { content: 'Qty', styles: { halign: 'center' } },
                    { content: 'Amount', styles: { halign: 'right' } }
                ]],
                body: option.parts.map(p => [p.name, p.quantity.toString(), `$${(p.cost * p.quantity).toFixed(2)}`]),
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
                columnStyles: { 
                    1: { halign: 'center' }, 
                    2: { halign: 'right' } 
                },
                margin: { left: colX, right: pageWidth - (colX + colWidth) }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10;
            
            const { subtotal, taxAmount, cashTotal, feeAmount, totalCost } = calculateQuoteOptionTotal(option, quote.salesTaxRate, quote.processingFeeRate);
            const cashDeposit = cashTotal * 0.30;
            const cashBalance = cashTotal - cashDeposit;
            const cardDeposit = totalCost * 0.30;
            const cardBalance = totalCost - cardDeposit;
            
            doc.setFontSize(8);
            doc.text('Subtotal', colX, currentY); doc.text(`$${subtotal.toFixed(2)}`, colX + colWidth, currentY, { align: 'right' }); currentY += 12;
            if (taxAmount > 0) {
                doc.text(`Sales Tax (${quote.salesTaxRate}%)`, colX, currentY); doc.text(`$${taxAmount.toFixed(2)}`, colX + colWidth, currentY, { align: 'right' }); currentY += 12;
            }
            currentY += 10;
            
            // --- Cash / Check total ---
            const cashY = currentY;
            const cashBoxHeight = 65;
            doc.setFillColor(248, 250, 252); // slate-50
            doc.roundedRect(colX, cashY, colWidth, cashBoxHeight, 5, 5, 'F');

            const cashLineY = cashY + 25;
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
            doc.text('Cash/Check Total', colX + 10, cashLineY - 4);

            doc.setDrawColor(226, 232, 240); // slate-200
            doc.line(colX + 10, cashLineY, colX + colWidth - 10, cashLineY);

            const cashFinalTotalY = cashLineY + 18;
            doc.setFontSize(7); doc.setTextColor('#475569');
            doc.text(`Deposit: $${cashDeposit.toFixed(2)}`, colX + 10, cashFinalTotalY);
            doc.text(`Balance: $${cashBalance.toFixed(2)}`, colX + 10, cashFinalTotalY + 9);

            doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
            doc.text(`$${cashTotal.toFixed(2)}`, colX + colWidth - 10, cashFinalTotalY, { align: 'right' });

            currentY = cashY + cashBoxHeight + 10;


            // --- Card total section ---
            let cardY = currentY;
            const cardBoxHeight = 84;
            doc.setFillColor(240, 249, 255); // sky-50
            doc.roundedRect(colX, cardY, colWidth, cardBoxHeight, 5, 5, 'F');

            // Job Total / Fee at the very top
            let topContentY = cardY + 10;
            doc.setFontSize(8); doc.setTextColor('#475569');
            doc.text('Job Total:', colX + 10, topContentY);
            doc.text(`$${cashTotal.toFixed(2)}`, colX + colWidth - 10, topContentY, { align: 'right' });
            doc.text('Card Fee:', colX + 10, topContentY + 10);
            doc.text(`+ $${feeAmount.toFixed(2)}`, colX + colWidth - 10, topContentY + 10, { align: 'right' });

            const lineY = cardY + 40;

            // "Card Total" just above the line
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
            doc.text('Card Total', colX + 10, lineY - 4);

            // Draw the line
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.line(colX + 10, lineY, colX + colWidth - 10, lineY);

            // Deposit/Balance and Final Total just below the line
            const finalTotalY = lineY + 18;
            doc.setFontSize(7);
            doc.text(`Deposit: $${cardDeposit.toFixed(2)}`, colX + 10, finalTotalY);
            doc.text(`Balance: $${cardBalance.toFixed(2)}`, colX + 10, finalTotalY + 9);

            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text(`$${totalCost.toFixed(2)}`, colX + colWidth - 10, finalTotalY, { align: 'right' });

            if ((cardY + cardBoxHeight) > maxY) {
                maxY = cardY + cardBoxHeight;
            }
        }
        yPos = maxY + 20;
    }

    // --- Payment Schedule ---
    const hasDeposit = quote.options.some(opt => calculateQuoteOptionTotal(opt, quote.salesTaxRate, quote.processingFeeRate).totalCost > 0);
    if (hasDeposit) {
        yPos = checkAndAddPage(yPos, 80);
        doc.setDrawColor('#e2e8f0'); doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 20;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor('#1e293b');
        doc.text('PAYMENT SCHEDULE', margin, yPos); yPos += 15;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#475569');
        const scheduleText = [
            "A deposit is due at contract signing to schedule the work.",
            "The remaining balance is due upon completion of the job."
        ];
        doc.text(scheduleText, margin, yPos);
        yPos += scheduleText.length * 12 + 10;
    }

    // --- Footer on every page ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor('#94a3b8'); // slate-400
        doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 30, { align: 'center' });
    }

    return { pdf: doc, fileName: `Quote for ${contact.name} - ${quote.quoteNumber}.pdf` };
};