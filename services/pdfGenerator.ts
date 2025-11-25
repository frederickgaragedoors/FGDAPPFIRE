import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Contact, JobTicket, BusinessInfo } from '../types.ts';
import { calculateJobTicketTotal, formatPhoneNumber } from '../utils.ts';

type DocType = 'receipt' | 'estimate';

interface GeneratePdfParams {
    contact: Contact;
    ticket: JobTicket;
    businessInfo: BusinessInfo;
    docType: DocType;
}

const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        if (!src) {
            return resolve(null);
        }
        
        const img = new Image();

        // **THIS IS THE FIX**: Set crossOrigin for cloud-hosted (http) images.
        // This is required to prevent a "tainted canvas" security error when jsPDF
        // tries to read the image data from a different origin (like Firebase Storage).
        // This error often fails silently, causing the image to disappear.
        if (src.startsWith('http')) {
            img.crossOrigin = "anonymous";
        }

        img.onload = () => resolve(img);

        img.onerror = (err) => {
            console.error("PDF Generator: Failed to load image element from URL. The image may be corrupt or the URL incorrect.", src, err);
            resolve(null); // Resolve null to allow PDF generation to continue without the image.
        };

        img.src = src;
    });
};

export const generatePdf = async ({ contact, ticket, businessInfo, docType }: GeneratePdfParams) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
    });

    // --- Calculations & Constants ---
    const { subtotal, taxAmount, feeAmount, totalCost, deposit, balanceDue } = calculateJobTicketTotal(ticket);
    const cashTotal = subtotal + taxAmount;
    const cardTotal = totalCost; 
    const depositRatio = totalCost > 0 ? deposit / totalCost : 0;
    const cashDeposit = cashTotal * depositRatio;
    const cashBalance = cashTotal - cashDeposit;
    const cardDeposit = deposit;
    const cardBalance = cardTotal - cardDeposit;
    const paymentStatus = ticket.paymentStatus || 'unpaid';
    
    let displayTitle = docType.toUpperCase();
    if (docType === 'receipt') {
        if (paymentStatus === 'paid_in_full') displayTitle = 'FINAL RECEIPT';
        else if (paymentStatus === 'deposit_paid') displayTitle = 'DEPOSIT RECEIPT';
        else displayTitle = 'INVOICE';
    }

    const hasInspectionResults = (ticket.inspection || []).some(i => ['Pass', 'Fail', 'Repaired'].includes(i.status || ''));
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    const bottomMargin = 50;
    let yPos = 40;

    const checkAndAddPage = (currentY: number, requiredSpace: number): number => {
        if (currentY + requiredSpace > pageHeight - bottomMargin) {
            doc.addPage();
            return margin;
        }
        return currentY;
    };

    // --- Robust Header Generation ---
    const logoSource = businessInfo.logoDataUrl || businessInfo.logoUrl;
    const loadedLogo = logoSource ? await loadImageElement(logoSource) : null;
    let logoDims = { width: 0, height: 0 };
    if (loadedLogo) {
        const aspectRatio = loadedLogo.width / loadedLogo.height;
        logoDims.height = 60;
        logoDims.width = logoDims.height * aspectRatio;
        if (logoDims.width > 150) {
            logoDims.width = 150;
            logoDims.height = logoDims.width / aspectRatio;
        }
    }
    
    doc.setFontSize(10);
    const businessInfoText = `${businessInfo.name || 'Your Company'}\n${businessInfo.address || ''}\n${businessInfo.phone || ''}\n${businessInfo.email || ''}`;
    const businessInfoHeight = doc.getTextDimensions(businessInfoText, { maxWidth: 200 }).h;

    doc.setFontSize(24);
    const titleLines = doc.splitTextToSize(displayTitle, 150);
    const titleHeight = doc.getTextDimensions(titleLines).h;
    const docInfoHeight = titleHeight + 35; 

    const maxHeaderHeight = Math.max(logoDims.height, businessInfoHeight, docInfoHeight);
    const topAlignY = yPos;

    if (loadedLogo) {
        try {
            doc.addImage(loadedLogo, 'PNG', margin, topAlignY, logoDims.width, logoDims.height);
        } catch (e) {
            console.error("jsPDF failed to add the pre-loaded image element:", e);
        }
    }
    
    const centerX = pageWidth / 2;
    let currentInfoY = topAlignY;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    const businessNameText = businessInfo.name || 'Your Company';
    const businessNameHeight = doc.getTextDimensions(businessNameText).h;
    doc.text(businessNameText, centerX, currentInfoY, { align: 'center', baseline: 'top' });
    currentInfoY += businessNameHeight + 5;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);

    const businessDetailsText = [
        businessInfo.address || '',
        businessInfo.phone || '',
        businessInfo.email || ''
    ].filter(Boolean).join('\n');

    const detailLines = doc.splitTextToSize(businessDetailsText, 180); 
    doc.text(detailLines, centerX, currentInfoY, { align: 'center', baseline: 'top' });

    const rightColX = pageWidth - margin;
    let docInfoY = topAlignY;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text(titleLines, rightColX, docInfoY, { align: 'right', baseline: 'top' });
    docInfoY += titleHeight + 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Job ID: ${ticket.id}`, rightColX, docInfoY, { align: 'right' });
    docInfoY += 14;
    doc.text(`Date: ${new Date(ticket.date).toLocaleDateString()}`, rightColX, docInfoY, { align: 'right' });
    
    yPos += maxHeaderHeight + 20;
    
    // Header separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 25;

    // --- Bill To / Service Location ---
    yPos = checkAndAddPage(yPos, 100);
    const leftColX = margin;
    const hasServiceLocation = ticket.jobLocation && ticket.jobLocation !== contact.address;
    const halfPageWidth = (pageWidth - (margin * 2)) / 2;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('BILL TO', leftColX, yPos);
    if (hasServiceLocation) {
        doc.text('SERVICE LOCATION', leftColX + halfPageWidth + 20, yPos);
    }
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(contact.name, leftColX, yPos);
    if (hasServiceLocation) {
        doc.text(ticket.jobLocationContactName || contact.name, leftColX + halfPageWidth + 20, yPos);
    }
    yPos += 14;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    const clientAddressLines = doc.splitTextToSize(contact.address || '', 250);
    let billToY = yPos + (clientAddressLines.length * 12);
    doc.text(clientAddressLines, leftColX, yPos);
    if(contact.phone) { doc.text(contact.phone, leftColX, billToY); billToY += 12; }
    if(contact.email) { doc.text(contact.email, leftColX, billToY); billToY += 12; }
    
    let serviceY = yPos;
    if (hasServiceLocation && ticket.jobLocation) {
        const serviceAddressLines = doc.splitTextToSize(ticket.jobLocation, 250);
        serviceY = yPos + (serviceAddressLines.length * 12);
        doc.text(serviceAddressLines, leftColX + halfPageWidth + 20, yPos);
        if (ticket.jobLocationContactPhone) {
            doc.text(formatPhoneNumber(ticket.jobLocationContactPhone), leftColX + halfPageWidth + 20, serviceY);
            serviceY += 12;
        }
    }
    yPos = Math.max(billToY, serviceY) + 20;
    
    // --- Item Table ---
    yPos = checkAndAddPage(yPos, 60);
    const tableColumn = ["Description", "Qty", "Unit Price", "Amount"];
    const tableRows = ticket.parts.map(part => [part.name, part.quantity.toString(), `$${part.cost.toFixed(2)}`, `$${(part.cost * part.quantity).toFixed(2)}`]);
    if (ticket.laborCost > 0) {
        tableRows.push(["Labor", "-", "-", `$${ticket.laborCost.toFixed(2)}`]);
    }
    autoTable(doc, {
        startY: yPos,
        head: [tableColumn], 
        body: tableRows, 
        theme: 'plain',
        headStyles: { 
            fillColor: false,
            textColor: [71, 85, 105], 
            fontStyle: 'bold',
            lineWidth: { bottom: 1.5 },
            lineColor: [226, 232, 240]
        },
        styles: { 
            fontSize: 10, 
            cellPadding: 8, 
            lineColor: [226, 232, 240], 
            lineWidth: { bottom: 0.5 } 
        },
        columnStyles: { 
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 40, halign: 'center' }, 
            2: { cellWidth: 80, halign: 'right' }, 
            3: { cellWidth: 80, halign: 'right' } 
        }
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;

    // --- Totals Section ---
    yPos = checkAndAddPage(yPos, 150);
    if (docType === 'estimate' && (ticket.processingFeeRate || 0) > 0) {
        // Renders the two-column payment options for estimates with card fees
        yPos = checkAndAddPage(yPos, 200);
        const rAlign = pageWidth - margin;
        let lAlign = rAlign - 150;

        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text("Subtotal:", lAlign, yPos);
        doc.text(`$${subtotal.toFixed(2)}`, rAlign, yPos, { align: 'right' });
        yPos += 15;

        if (taxAmount > 0) {
            doc.text(`Sales Tax (${ticket.salesTaxRate}%):`, lAlign, yPos);
            doc.text(`$${taxAmount.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 15;
        }
        yPos += 10;
        doc.setDrawColor(220);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 20;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("PAYMENT OPTIONS", pageWidth / 2, yPos, { align: 'center' });
        yPos += 25;

        const colWidth = (pageWidth - margin * 2 - 20) / 2;
        const col1X = margin;
        const col2X = margin + colWidth + 20;
        let startY = yPos;
        
        let cashBoxHeight = 78; 
        if(deposit > 0) cashBoxHeight += 30;
        cashBoxHeight += 10;

        let cardBoxHeight = 98;
        if(deposit > 0) cardBoxHeight += 30;
        cardBoxHeight += 10;

        const maxHeight = Math.max(cashBoxHeight, cardBoxHeight);

        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(col1X, startY - 15, colWidth, maxHeight, 5, 5, 'F');
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(50);
        doc.text("Cash / Check", col1X + colWidth / 2, startY, { align: 'center' });
        doc.setDrawColor(220); doc.line(col1X + 10, startY + 10, col1X + colWidth - 10, startY + 10);
        
        let cashY = startY + 30;
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        if (deposit > 0) {
            doc.text("Required Deposit (30%):", col1X + 10, cashY); doc.text(`$${cashDeposit.toFixed(2)}`, col1X + colWidth - 10, cashY, { align: 'right' }); cashY += 15;
            doc.text("Balance Due (70%):", col1X + 10, cashY); doc.text(`$${cashBalance.toFixed(2)}`, col1X + colWidth - 10, cashY, { align: 'right' }); cashY += 15;
        }
        doc.line(col1X + 10, cashY, col1X + colWidth - 10, cashY); cashY += 18;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text("Total", col1X + 10, cashY); doc.text(`$${cashTotal.toFixed(2)}`, col1X + colWidth - 10, cashY, { align: 'right' });
        
        doc.setFillColor(240, 249, 255);
        doc.roundedRect(col2X, startY - 15, colWidth, maxHeight, 5, 5, 'F');
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(50);
        doc.text("Card Payment", col2X + colWidth / 2, startY, { align: 'center' });
        doc.line(col2X + 10, startY + 10, col2X + colWidth - 10, startY + 10);
        
        let cardY = startY + 30;
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`Processing Fee (${ticket.processingFeeRate}%):`, col2X + 10, cardY); doc.text(`$${feeAmount.toFixed(2)}`, col2X + colWidth - 10, cardY, { align: 'right' }); cardY += 20;
        if (deposit > 0) {
            doc.text("Required Deposit (30%):", col2X + 10, cardY); doc.text(`$${cardDeposit.toFixed(2)}`, col2X + colWidth - 10, cardY, { align: 'right' }); cardY += 15;
            doc.text("Balance Due (70%):", col2X + 10, cardY); doc.text(`$${cardBalance.toFixed(2)}`, col2X + colWidth - 10, cardY, { align: 'right' }); cardY += 15;
        }
        doc.line(col2X + 10, cardY, col2X + colWidth - 10, cardY); cardY += 18;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text("Total", col2X + 10, cardY); doc.text(`$${cardTotal.toFixed(2)}`, col2X + colWidth - 10, cardY, { align: 'right' });
        
        yPos = startY - 15 + maxHeight + 15;
    } else {
        // Standard single-column layout for Receipts and simple Estimates
        const rAlign = pageWidth - margin;
        const lAlign = rAlign - 150;
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text("Subtotal:", lAlign, yPos); doc.text(`$${subtotal.toFixed(2)}`, rAlign, yPos, { align: 'right' }); yPos += 15;
        if (taxAmount > 0) {
            doc.text(`Sales Tax (${ticket.salesTaxRate}%):`, lAlign, yPos); doc.text(`$${taxAmount.toFixed(2)}`, rAlign, yPos, { align: 'right' }); yPos += 15;
        }
        if (feeAmount > 0) {
            doc.text(`Processing Fee (${ticket.processingFeeRate}%):`, lAlign, yPos); doc.text(`$${feeAmount.toFixed(2)}`, rAlign, yPos, { align: 'right' }); yPos += 15;
        }
        yPos += 5;
        doc.setDrawColor(200); doc.line(lAlign - 10, yPos - 10, rAlign, yPos - 10);
        yPos += 4;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text("Total:", lAlign, yPos); doc.text(`$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' }); yPos += 20;
        
        if (docType === 'receipt') {
            if (paymentStatus === 'paid_in_full') {
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
                doc.text("Amount Paid:", lAlign, yPos); doc.setFont('helvetica', 'normal'); doc.text(`-$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 15;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$0.00`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            } else if (paymentStatus === 'deposit_paid' && deposit > 0) {
                 doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
                doc.text("Deposit Paid:", lAlign, yPos); doc.setFont('helvetica', 'normal'); doc.text(`-$${deposit.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 15;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$${balanceDue.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            } else { // Unpaid receipt
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            }
        } else if (deposit > 0) { // Estimate with deposit but no card fee
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(50);
            doc.text("Required Deposit (30%):", lAlign, yPos); doc.text(`$${deposit.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 15;
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
            doc.text("Balance Due (70%):", lAlign, yPos); doc.text(`$${balanceDue.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 20;
        }
    }

    // --- Payment Schedule for Estimates ---
    if (docType === 'estimate' && deposit > 0) {
        yPos = checkAndAddPage(yPos, 80);
        yPos += 10;
        doc.setDrawColor(220);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 20;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("PAYMENT SCHEDULE", margin, yPos);
        yPos += 20;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        
        const scheduleText = [
            "- A deposit is due at contract signing to schedule the work.",
            "- The remaining balance is due upon completion of the job."
        ];

        doc.text(scheduleText, margin, yPos);
        yPos += scheduleText.length * 15 + 10;
        
        doc.setDrawColor(220);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
    }

    // --- Inspection Summary ---
    if (hasInspectionResults) {
        yPos = checkAndAddPage(yPos, 150);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("25-POINT SAFETY INSPECTION", margin, yPos);
        yPos += 15;
        
        const failedOrRepaired = (ticket.inspection || []).filter(i => i.status === 'Fail' || i.status === 'Repaired');
        const passedCount = (ticket.inspection || []).filter(i => i.status === 'Pass').length;

        if (failedOrRepaired.length > 0) {
            autoTable(doc, {
                startY: yPos + 5,
                head: [["Item", "Status", "Notes"]],
                body: failedOrRepaired.map(item => [item.name, item.status || 'N/A', item.notes || '']),
                theme: 'plain',
                headStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
                columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60, fontStyle: 'bold' }, 2: { cellWidth: 'auto' } }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }
        if (passedCount > 0) {
            doc.setFontSize(9);
            doc.setTextColor(70);
            doc.text(`${passedCount} additional items passed safety inspection.`, margin, yPos);
            yPos += 15;
        }
    }

    // --- Footer on every page ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 30, { align: 'center' });
    }

    return { pdf: doc, fileName: `${contact.name} - ${displayTitle} ${ticket.id}.pdf` };
};
