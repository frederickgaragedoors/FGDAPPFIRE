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
    
    const infoBlockWidth = pageWidth - margin * 2 - logoDims.width - 150;
    const businessInfoText = `${businessInfo.name || 'Your Company'}\n${businessInfo.address || ''}\n${businessInfo.phone || ''}\n${businessInfo.email || ''}`;
    doc.setFontSize(10);
    const businessInfoHeight = doc.getTextDimensions(businessInfoText, { maxWidth: infoBlockWidth }).h + 20;

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(displayTitle, 150);
    const titleHeight = doc.getTextDimensions(titleLines).h;
    const docInfoHeight = titleHeight + 35; 

    const maxHeaderHeight = Math.max(logoDims.height, businessInfoHeight, docInfoHeight);

    if (loadedLogo) {
        try {
            doc.addImage(loadedLogo, 'PNG', margin, yPos, logoDims.width, logoDims.height);
        } catch (e) {
            console.error("jsPDF failed to add the pre-loaded image element:", e);
        }
    }
    
    const centerX = pageWidth / 2;
    let currentInfoY = yPos + 10;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(businessInfo.name || 'Your Company', centerX, currentInfoY, { align: 'center' });
    currentInfoY += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);

    const businessDetailsText = [
        businessInfo.address || '',
        businessInfo.phone || '',
        businessInfo.email || ''
    ].filter(Boolean).join('\n');

    const detailLines = doc.splitTextToSize(businessDetailsText, 180); 
    doc.text(detailLines, centerX, currentInfoY, { align: 'center' });

    const rightColX = pageWidth - margin;
    let docInfoY = yPos + 10;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text(titleLines, rightColX, docInfoY, { align: 'right' });
    docInfoY += titleHeight + 5;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Job ID: ${ticket.id}`, rightColX, docInfoY, { align: 'right' });
    docInfoY += 14;
    doc.text(`Date: ${new Date(ticket.date).toLocaleDateString()}`, rightColX, docInfoY, { align: 'right' });
    
    yPos += maxHeaderHeight + 35;
    
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
        head: [tableColumn], body: tableRows, theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 8, lineColor: [226, 232, 240], lineWidth: 0.5 },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 80, halign: 'right' }, 3: { cellWidth: 80, halign: 'right' } }
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;

    // --- Totals Section ---
    yPos = checkAndAddPage(yPos, docType === 'estimate' && ticket.processingFeeRate > 0 ? 200 : 150);
    if (docType === 'estimate' && ticket.processingFeeRate > 0) {
        // Dual Column Estimate Layout logic here...
    } else {
        const rAlign = pageWidth - margin;
        const lAlign = rAlign - 150;
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text("Subtotal:", lAlign, yPos);
        doc.text(`$${subtotal.toFixed(2)}`, rAlign, yPos, { align: 'right' });
        yPos += 15;
        if (ticket.salesTaxRate > 0) {
            doc.text(`Sales Tax (${ticket.salesTaxRate}%):`, lAlign, yPos);
            doc.text(`$${taxAmount.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 15;
        }
        if (ticket.processingFeeRate > 0) {
            doc.text(`Processing Fee (${ticket.processingFeeRate}%):`, lAlign, yPos);
            doc.text(`$${feeAmount.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 15;
        }
        yPos += 5;
        doc.setDrawColor(200);
        doc.line(lAlign - 10, yPos - 10, rAlign, yPos - 10);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("Total:", lAlign, yPos);
        doc.text(`$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' });
        yPos += 20;
        
        if (docType === 'receipt') {
            if (paymentStatus === 'paid_in_full') {
                doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(22, 163, 74);
                doc.text("Amount Paid:", lAlign, yPos); doc.text(`-$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 15;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$0.00`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            } else if (paymentStatus === 'deposit_paid' && deposit > 0) {
                doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(22, 163, 74);
                doc.text("Deposit Paid:", lAlign, yPos); doc.text(`-$${deposit.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 15;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$${balanceDue.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            } else {
                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, yPos); doc.text(`$${totalCost.toFixed(2)}`, rAlign, yPos, { align: 'right' });
                yPos += 20;
            }
        } else if (deposit > 0) { // Estimate with deposit
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(50);
            doc.text("Required Deposit:", lAlign, yPos); doc.text(`$${deposit.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 15;
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
            doc.text("Balance Due:", lAlign, yPos); doc.text(`$${balanceDue.toFixed(2)}`, rAlign, yPos, { align: 'right' });
            yPos += 20;
        }
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
                headStyles: { fillColor: [255, 235, 235], textColor: [153, 27, 27], fontStyle: 'bold' },
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
