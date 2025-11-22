
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

export const generatePdf = async ({ contact, ticket, businessInfo, docType }: GeneratePdfParams) => {
    // Initialize jsPDF with default export
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
    });

    // --- Calculations ---
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

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 50;
    const startY = 40;

    let logoWidth = 0;
    let logoHeight = 0;
    let headerHeight = 0;

    // --- 1. Logo (Left Margin) ---
    if (businessInfo.logoUrl) {
        try {
            const getImageDimensions = (src: string): Promise<{ width: number; height: number } | null> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.width, height: img.height });
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            };

            const dims = await getImageDimensions(businessInfo.logoUrl);
            if (dims) {
                const aspectRatio = dims.width / dims.height;
                logoHeight = 60; // Fixed height target
                logoWidth = logoHeight * aspectRatio;

                if (logoWidth > 150) {
                    logoWidth = 150;
                    logoHeight = logoWidth / aspectRatio;
                }

                const format = businessInfo.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                doc.addImage(businessInfo.logoUrl, format, margin, startY, logoWidth, logoHeight);
            }
        } catch (e) {
            console.warn("Could not add logo", e);
        }
    }

    // --- 2. Business Info (Right of Logo) ---
    const infoX = margin + logoWidth + (logoWidth > 0 ? 20 : 0);
    let infoY = startY + 10;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(businessInfo.name || 'Your Company', infoX, infoY);
    
    infoY += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    const rightColWidth = 150;
    const maxInfoWidth = pageWidth - margin - rightColWidth - infoX - 20;
    const safeInfoWidth = Math.max(maxInfoWidth, 200);

    const addressLines = doc.splitTextToSize(businessInfo.address || '', safeInfoWidth);
    doc.text(addressLines, infoX, infoY);
    infoY += (addressLines.length * 12);
    
    if (businessInfo.phone) {
        doc.text(businessInfo.phone, infoX, infoY);
        infoY += 12;
    }
    if (businessInfo.email) {
        doc.text(businessInfo.email, infoX, infoY);
        infoY += 12;
    }
    
    const infoBlockHeight = infoY - startY;
    headerHeight = Math.max(logoHeight, infoBlockHeight);

    // --- 3. Document Info (Far Right) ---
    let docInfoY = startY + 10;
    const rightColX = pageWidth - margin;
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text(displayTitle, rightColX, docInfoY, { align: 'right' });
    docInfoY += 25;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Job ID: ${ticket.id}`, rightColX, docInfoY, { align: 'right' });
    docInfoY += 14;
    doc.text(`Date: ${new Date(ticket.date).toLocaleDateString()}`, rightColX, docInfoY, { align: 'right' });
    
    let yPos = startY + Math.max(headerHeight, docInfoY - startY) + 35;
    
    // --- Bill To ---
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
    
    // Bill To Content
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(contact.name, leftColX, yPos);
    
    // Service Location Content
    if (hasServiceLocation) {
        const siteName = ticket.jobLocationContactName || contact.name;
        doc.text(siteName, leftColX + halfPageWidth + 20, yPos);
    }

    yPos += 14;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    
    const clientAddressLines = doc.splitTextToSize(contact.address || '', 250);
    doc.text(clientAddressLines, leftColX, yPos);
    
    let billToY = yPos + (clientAddressLines.length * 12) + 5;
    if(contact.phone) {
            doc.text(contact.phone, leftColX, billToY);
            billToY += 12;
    }
    if(contact.email) {
            doc.text(contact.email, leftColX, billToY);
            billToY += 12;
    }

    let serviceY = yPos;
    if (hasServiceLocation && ticket.jobLocation) {
            const serviceAddressLines = doc.splitTextToSize(ticket.jobLocation, 250);
            doc.text(serviceAddressLines, leftColX + halfPageWidth + 20, yPos);
            serviceY = yPos + (serviceAddressLines.length * 12) + 5;

            if (ticket.jobLocationContactPhone) {
                doc.text(formatPhoneNumber(ticket.jobLocationContactPhone), leftColX + halfPageWidth + 20, serviceY);
                serviceY += 12;
            }
    }
    
    yPos = Math.max(billToY, serviceY) + 20;

    // --- Item Table ---
    const tableColumn = ["Description", "Qty", "Unit Price", "Amount"];
    const tableRows: string[][] = [];

    ticket.parts.forEach(part => {
        const partData = [
            part.name,
            part.quantity.toString(),
            `$${part.cost.toFixed(2)}`,
            `$${(part.cost * part.quantity).toFixed(2)}`
        ];
        tableRows.push(partData);
    });
    
    if (ticket.laborCost > 0) {
        tableRows.push(["Labor", "-", "-", `$${ticket.laborCost.toFixed(2)}`]);
    }

    autoTable(doc, {
        startY: yPos,
        head: [tableColumn],
        body: tableRows,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' }, 
        styles: { fontSize: 10, cellPadding: 8, lineColor: [226, 232, 240], lineWidth: 0.5 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 80, halign: 'right' },
            3: { cellWidth: 80, halign: 'right' }
        }
    });
    
    let finalY = (doc as any).lastAutoTable.finalY + 30;

    // --- Totals & Payment Options ---
    
    if (finalY > doc.internal.pageSize.getHeight() - 200) {
        doc.addPage();
        finalY = 40;
    }

    if (docType === 'estimate' && ticket.processingFeeRate > 0) {
            // ** Dual Column Estimate Layout **
            doc.setFontSize(10);
            doc.setTextColor(50);
            const rAlign = pageWidth - margin;
            
            doc.text(`Subtotal: $${subtotal.toFixed(2)}`, rAlign, finalY, {align: 'right'});
            finalY += 15;
            if (ticket.salesTaxRate > 0) {
                doc.text(`Sales Tax (${ticket.salesTaxRate}%): $${taxAmount.toFixed(2)}`, rAlign, finalY, {align: 'right'});
                finalY += 25;
            } else {
                finalY += 10;
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text("PAYMENT OPTIONS", pageWidth / 2, finalY, { align: 'center' });
            finalY += 20;
            
            const boxWidth = 240;
            const boxHeight = 130;
            const boxY = finalY;
            
            const leftBoxX = margin;
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(leftBoxX, boxY, boxWidth, boxHeight, 5, 5, 'FD');
            
            doc.setFontSize(11);
            doc.text("Cash / Check", leftBoxX + (boxWidth/2), boxY + 20, { align: 'center' });
            
            doc.setDrawColor(226, 232, 240);
            doc.line(leftBoxX + 20, boxY + 30, leftBoxX + boxWidth - 20, boxY + 30);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            let innerY = boxY + 50;
            
            if (deposit > 0) {
            doc.text("Required Deposit (30%)", leftBoxX + 15, innerY);
            doc.text(`$${cashDeposit.toFixed(2)}`, leftBoxX + boxWidth - 15, innerY, { align: 'right' });
            innerY += 20;
            
            doc.text("Balance Due (70%)", leftBoxX + 15, innerY);
            doc.text(`$${cashBalance.toFixed(2)}`, leftBoxX + boxWidth - 15, innerY, { align: 'right' });
            innerY += 25;

            doc.setDrawColor(226, 232, 240);
            doc.line(leftBoxX + 15, innerY - 15, leftBoxX + boxWidth - 15, innerY - 15);
            } else {
            innerY += 45;
            }
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text("Total", leftBoxX + 15, innerY);
            doc.text(`$${cashTotal.toFixed(2)}`, leftBoxX + boxWidth - 15, innerY, { align: 'right' });

            const rightBoxX = pageWidth - margin - boxWidth;
            doc.setFillColor(240, 249, 255);
            doc.setDrawColor(186, 230, 253);
            doc.roundedRect(rightBoxX, boxY, boxWidth, boxHeight, 5, 5, 'FD');
            
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text("Card Payment", rightBoxX + (boxWidth/2), boxY + 20, { align: 'center' });

            doc.setDrawColor(186, 230, 253);
            doc.line(rightBoxX + 20, boxY + 30, rightBoxX + boxWidth - 20, boxY + 30);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50);
            innerY = boxY + 50;

            doc.text(`Processing Fee (${ticket.processingFeeRate}%)`, rightBoxX + 15, innerY);
            doc.text(`$${feeAmount.toFixed(2)}`, rightBoxX + boxWidth - 15, innerY, { align: 'right' });
            innerY += 20;

            if (deposit > 0) {
                doc.setDrawColor(186, 230, 253);
                doc.line(rightBoxX + 15, innerY - 12, rightBoxX + boxWidth - 15, innerY - 12);

                doc.text("Required Deposit (30%)", rightBoxX + 15, innerY);
                doc.text(`$${cardDeposit.toFixed(2)}`, rightBoxX + boxWidth - 15, innerY, { align: 'right' });
                innerY += 20;
                
                doc.text("Balance Due (70%)", rightBoxX + 15, innerY);
                doc.text(`$${cardBalance.toFixed(2)}`, rightBoxX + boxWidth - 15, innerY, { align: 'right' });
                innerY += 25; 
            } else {
                doc.text("Job Total", rightBoxX + 15, innerY);
                doc.text(`$${cashTotal.toFixed(2)}`, rightBoxX + boxWidth - 15, innerY, { align: 'right' });
                innerY += 25;
            }

            doc.setDrawColor(186, 230, 253);
            doc.line(rightBoxX + 15, innerY - 15, rightBoxX + boxWidth - 15, innerY - 15);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text("Total", rightBoxX + 15, innerY);
            doc.text(`$${cardTotal.toFixed(2)}`, rightBoxX + boxWidth - 15, innerY, { align: 'right' });

            finalY += boxHeight + 30;

    } else {
        // ** Standard Single Column Layout **
        const rAlign = pageWidth - margin;
        const lAlign = rAlign - 150;
        
        doc.setFontSize(10);
        doc.setTextColor(50);
        
        doc.text("Subtotal:", lAlign, finalY);
        doc.text(`$${subtotal.toFixed(2)}`, rAlign, finalY, { align: 'right' });
        finalY += 15;
        
        if (ticket.salesTaxRate > 0) {
            doc.text(`Sales Tax (${ticket.salesTaxRate}%):`, lAlign, finalY);
            doc.text(`$${taxAmount.toFixed(2)}`, rAlign, finalY, { align: 'right' });
            finalY += 15;
        }
        
        if (ticket.processingFeeRate > 0) {
                doc.text(`Processing Fee (${ticket.processingFeeRate}%):`, lAlign, finalY);
                doc.text(`$${feeAmount.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                finalY += 15;
        }
        
        finalY += 5;
        doc.setDrawColor(200);
        doc.line(lAlign - 10, finalY - 10, rAlign, finalY - 10);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("Total:", lAlign, finalY);
        doc.text(`$${totalCost.toFixed(2)}`, rAlign, finalY, { align: 'right' });
        finalY += 20;
        
        // Logic for Receipts
        if (docType === 'receipt') {
            if (paymentStatus === 'paid_in_full') {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(22, 163, 74);
                    doc.text("Amount Paid:", lAlign, finalY);
                    doc.text(`-$${totalCost.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                    finalY += 15;
                    
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0);
                    doc.text("Balance Due:", lAlign, finalY);
                    doc.text(`$0.00`, rAlign, finalY, { align: 'right' });
                    finalY += 20;

            } else if (paymentStatus === 'deposit_paid' && deposit > 0) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(22, 163, 74);
                    doc.text("Deposit Paid:", lAlign, finalY);
                    doc.text(`-$${deposit.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                    finalY += 15;
                    
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0);
                    doc.text("Balance Due:", lAlign, finalY);
                    doc.text(`$${balanceDue.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                    finalY += 20;
            } else {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0);
                    doc.text("Balance Due:", lAlign, finalY);
                    doc.text(`$${totalCost.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                    finalY += 20;
            }
        } else {
            // Estimate logic
                if (deposit > 0) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50);
                doc.text("Required Deposit:", lAlign, finalY);
                doc.text(`$${deposit.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                finalY += 15;
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0);
                doc.text("Balance Due:", lAlign, finalY);
                doc.text(`$${balanceDue.toFixed(2)}`, rAlign, finalY, { align: 'right' });
                finalY += 20;
            }
        }
    }

    // --- Payment Terms / Schedule ---
    if (docType === 'estimate' && deposit > 0) {
        if (finalY > doc.internal.pageSize.getHeight() - 100) {
            doc.addPage();
            finalY = 40;
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("PAYMENT SCHEDULE", margin, finalY);
        finalY += 15;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text("• A deposit is due at contract signing to schedule the work.", margin + 10, finalY);
        finalY += 15;
        doc.text("• The remaining balance is due upon completion of the job.", margin + 10, finalY);
        finalY += 20;
    }

    // --- Inspection Summary ---
    if (hasInspectionResults) {
            if (finalY > doc.internal.pageSize.getHeight() - 150) {
            doc.addPage();
            finalY = 40;
            } else {
            finalY += 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text("25-POINT SAFETY INSPECTION", margin, finalY);
            finalY += 15;
            
            const failedOrRepaired = (ticket.inspection || []).filter(i => i.status === 'Fail' || i.status === 'Repaired');
            const passed = (ticket.inspection || []).filter(i => i.status === 'Pass');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            if (failedOrRepaired.length > 0) {
            const tableColumn = ["Item", "Status", "Notes"];
            const tableRows = failedOrRepaired.map(item => [
                item.name, 
                item.status || 'N/A', 
                item.notes || ''
            ]);

            autoTable(doc, {
                startY: finalY + 5,
                head: [tableColumn],
                body: tableRows,
                theme: 'plain',
                headStyles: { fillColor: [255, 235, 235], textColor: [153, 27, 27], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
                columnStyles: {
                    0: { cellWidth: 120 },
                    1: { cellWidth: 60, fontStyle: 'bold' },
                    2: { cellWidth: 'auto' }
                }
            });
            
            finalY = (doc as any).lastAutoTable.finalY + 15;
            }

            if (passed.length > 0) {
                doc.setFontSize(9);
                doc.setTextColor(70);
                doc.text(`${passed.length} additional items passed safety inspection.`, margin, finalY);
                finalY += 15;
            }
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text("Thank you for your business!", pageWidth / 2, doc.internal.pageSize.getHeight() - 30, { align: 'center' });

    return { pdf: doc, fileName: `${contact.name} - ${displayTitle} ${ticket.id}.pdf` };
};
