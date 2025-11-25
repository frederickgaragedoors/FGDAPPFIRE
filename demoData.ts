
import { Contact, JobTicket, DoorProfile, JobStatus, PaymentStatus } from './types.ts';
import { generateId } from './utils.ts';

const createJob = (
    status: JobStatus, 
    dateOffset: number, 
    description: string, 
    amount: number, 
    paymentStatus: PaymentStatus = 'unpaid'
): JobTicket => {
    const date = new Date();
    date.setDate(date.getDate() + dateOffset);
    
    return {
        id: generateId(),
        date: date.toISOString().split('T')[0],
        time: '09:00',
        duration: 60,
        status: status,
        paymentStatus: paymentStatus,
        notes: description,
        parts: [
            { id: generateId(), name: 'Service Call', quantity: 1, cost: 89.00 },
            { id: generateId(), name: 'Labor', quantity: 1, cost: amount - 89.00 }
        ],
        laborCost: 0, // simplified for demo
        salesTaxRate: 0,
        processingFeeRate: 0,
        deposit: 0,
        createdAt: new Date().toISOString(),
        inspection: []
    };
};

export const generateDemoContacts = (): Contact[] => {
    const now = new Date();
    const contacts: Contact[] = [
        {
            id: generateId(),
            name: "Alice Johnson",
            email: "alice.j@example.com",
            phone: "555-0101",
            address: "123 Maple Ave, Springfield, IL",
            photoUrl: "https://randomuser.me/api/portraits/women/44.jpg",
            files: [],
            customFields: [],
            doorProfiles: [
                {
                    id: generateId(),
                    dimensions: "16x7",
                    doorType: "Sectional",
                    springSystem: "Torsion",
                    springs: [{ id: generateId(), size: ".250 x 2 x 32" }, { id: generateId(), size: ".250 x 2 x 32" }],
                    openerBrand: "LiftMaster",
                    openerModel: "8550W",
                    doorInstallDate: "2018-05-15",
                    springInstallDate: "2023-01-10",
                    openerInstallDate: "2018-05-15"
                }
            ],
            jobTickets: [
                createJob('Paid', -5, "Replaced both torsion springs. Tuned and lubed door.", 350, 'paid_in_full'),
                createJob('Scheduled', 2, "Annual Maintenance Check", 89, 'unpaid')
            ],
            lastModified: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: generateId(),
            name: "Bob's Auto Repair",
            email: "bob@bobsauto.com",
            phone: "555-0102",
            address: "456 Industrial Pkwy, Springfield, IL",
            photoUrl: "",
            files: [],
            customFields: [{ id: generateId(), label: "Gate Code", value: "#1234" }],
            doorProfiles: [
                {
                    id: generateId(),
                    dimensions: "12x14",
                    doorType: "Rolling Steel",
                    springSystem: "Torsion",
                    springs: [],
                    openerBrand: "Unknown",
                    openerModel: "Jackshaft",
                    doorInstallDate: "Unknown",
                    springInstallDate: "Unknown",
                    openerInstallDate: "Unknown"
                }
            ],
            jobTickets: [
                createJob('In Progress', 0, "Door stuck open. diagnosing opener issue.", 0, 'unpaid')
            ],
            lastModified: now.toISOString(),
        },
        {
            id: generateId(),
            name: "Charlie Davis",
            email: "charlie.d@example.com",
            phone: "555-0103",
            address: "789 Oak Ln, Shelbyville, IL",
            photoUrl: "https://randomuser.me/api/portraits/men/32.jpg",
            files: [],
            customFields: [],
            doorProfiles: [],
            jobTickets: [
                createJob('Quote Sent', -2, "Estimate for new garage door installation (Sandstone, Insulated).", 1800, 'unpaid')
            ],
            lastModified: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: generateId(),
            name: "Diana Prince",
            email: "diana@example.com",
            phone: "555-0104",
            address: "101 Hero Way, Metropolis, IL",
            photoUrl: "https://randomuser.me/api/portraits/women/68.jpg",
            files: [],
            customFields: [],
            doorProfiles: [
                {
                    id: generateId(),
                    dimensions: "8x7",
                    doorType: "One-piece",
                    springSystem: "Extension",
                    springs: [{ id: generateId(), size: "P-728" }],
                    openerBrand: "Genie",
                    openerModel: "Screw Drive",
                    doorInstallDate: "Original",
                    springInstallDate: "2020-08-20",
                    openerInstallDate: "2015-03-12"
                }
            ],
            jobTickets: [
                createJob('Completed', -30, "Replaced safety sensors.", 150, 'paid_in_full')
            ],
            lastModified: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: generateId(),
            name: "Evan Wright",
            email: "evan.w@example.com",
            phone: "555-0105",
            address: "202 Pine St, Springfield, IL",
            photoUrl: "",
            files: [],
            customFields: [],
            doorProfiles: [],
            jobTickets: [], // New lead
            lastModified: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        }
    ];

    return contacts;
};
