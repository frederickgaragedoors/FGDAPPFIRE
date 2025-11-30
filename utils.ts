import { JobTicket, Contact } from './types.ts';

/**
 * Generates a short, secure uppercase alphanumeric ID.
 */
export const generateId = (): string => {
  // Use crypto API if available for better entropy
  // Cast to any because TS might not know about randomUUID in older lib targets or specific envs
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c && typeof (c as any).randomUUID === 'function') {
    return (c as any).randomUUID().split('-')[0].toUpperCase();
  }
  return Math.random().toString(36).substring(2, 9).toUpperCase();
};

/**
 * Converts a File object to a Base64 encoded data URL.
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Formats a file size in bytes into a human-readable string (KB, MB, etc.).
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extracts the initials from a full name.
 */
export const getInitials = (name: string): string => {
    const names = name.trim().split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0] ? names[0][0].toUpperCase() : '';
};

/**
 * Formats a phone number string to (XXX) XXX-XXXX if it contains 10 digits.
 */
export const formatPhoneNumber = (phoneNumber: string | undefined): string => {
  if (!phoneNumber) return '';
  const cleaned = ('' + phoneNumber).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phoneNumber;
};

/**
 * Calculates the subtotal, tax, fees, final total, deposit and balance due for a job ticket.
 * @param ticket The JobTicket object.
 * @returns An object with the detailed cost breakdown.
 */
export const calculateJobTicketTotal = (ticket: JobTicket | null) => {
    if (!ticket) {
        return { subtotal: 0, taxAmount: 0, feeAmount: 0, totalCost: 0, deposit: 0, balanceDue: 0 };
    }
    const partsTotal = ticket.parts.reduce((sum, part) => sum + (Number(part.cost || 0) * Number(part.quantity || 1)), 0);
    const subtotal = partsTotal + Number(ticket.laborCost || 0);
    const taxAmount = subtotal * (Number(ticket.salesTaxRate || 0) / 100);
    const totalAfterTaxes = subtotal + taxAmount;
    const feeAmount = totalAfterTaxes * (Number(ticket.processingFeeRate || 0) / 100);
    const totalCost = totalAfterTaxes + feeAmount;
    const deposit = Number(ticket.deposit || 0);
    const balanceDue = totalCost - deposit;
    
    return {
        subtotal,
        taxAmount,
        feeAmount,
        totalCost,
        deposit,
        balanceDue
    };
};

/**
 * Formats a 24h time string (HH:MM) to 12h format with AM/PM.
 */
export const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours24, minutes] = time.split(':');
    const hours = parseInt(hours24, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${suffix}`;
};

/**
 * Triggers a browser download for a JSON file.
 * @param data The object to serialize into JSON.
 * @param filename The desired filename for the download.
 */
export const downloadJsonFile = (data: object, filename: string): void => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Saves a JSON file, allowing the user to choose the location if the browser supports it.
 * Falls back to a direct download otherwise.
 * @param data The object to serialize into JSON.
 * @param filename The desired filename for the download.
 */
export const saveJsonFile = async (data: object, filename: string): Promise<void> => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Use the File System Access API if available
    // Check if we are in a secure context and not in a cross-origin iframe which might block this API
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [
                    {
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return; // Success
        } catch (err: any) {
            // AbortError is thrown when the user cancels the save dialog.
            if (err.name === 'AbortError') {
                console.log('User cancelled save dialog.');
                return;
            }
            // Handle SecurityError (cross-origin frames) or other errors gracefully
            console.warn('File System Access API skipped (fallback to download):', err.message);
        }
    }

    // Fallback for browsers that don't support the API or failed due to security context
    downloadJsonFile(data, filename);
};


/**
 * Generates an iCalendar string from a list of contacts and their job tickets.
 */
export const generateICSContent = (contacts: Contact[]): string => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Business Contacts Manager//EN\nCALSCALE:GREGORIAN\n";

    const formatDate = (dateStr: string, timeStr?: string): string => {
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        
        if (timeStr) {
            const [hours, minutes] = timeStr.split(':');
            return `${year}${month}${day}T${hours}${minutes}00`;
        }
        return `${year}${month}${day}`;
    };

    contacts.forEach(contact => {
        if (!contact.jobTickets) return;
        
        contact.jobTickets.forEach(ticket => {
            if (!ticket.date) return;

            const startDateTime = formatDate(ticket.date, ticket.time);
            const isAllDay = !ticket.time;

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${ticket.id}@businesscontactsmanager\n`;
            icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
            
            if (isAllDay) {
                icsContent += `DTSTART;VALUE=DATE:${startDateTime}\n`;
            } else {
                icsContent += `DTSTART:${startDateTime}\n`;
                // Default duration 1 hour if not specified
                // Parsing date again to add hour for DTEND
                const year = parseInt(startDateTime.substring(0,4));
                const month = parseInt(startDateTime.substring(4,6)) - 1;
                const day = parseInt(startDateTime.substring(6,8));
                const hour = parseInt(startDateTime.substring(9,11));
                const min = parseInt(startDateTime.substring(11,13));
                const end = new Date(year, month, day, hour + 1, min);
                const endYear = end.getFullYear();
                const endMonth = String(end.getMonth() + 1).padStart(2, '0');
                const endDay = String(end.getDate()).padStart(2, '0');
                const endHour = String(end.getHours()).padStart(2, '0');
                const endMin = String(end.getMinutes()).padStart(2, '0');
                icsContent += `DTEND:${endYear}${endMonth}${endDay}T${endHour}${endMin}00\n`;
            }

            const summary = `${contact.name} - ${ticket.status}`;
            let description = `Job ID: ${ticket.id}\\nStatus: ${ticket.status}\\n`;
            if (ticket.notes) description += `Notes: ${ticket.notes.replace(/\n/g, '\\n')}\\n`;
            if (contact.phone) description += `Phone: ${contact.phone}\\n`;
            if (contact.email) description += `Email: ${contact.email}\\n`;
            
            icsContent += `SUMMARY:${summary}\n`;
            icsContent += `DESCRIPTION:${description}\n`;
            
            // Use Job Location if available, otherwise Contact Address
            const location = ticket.jobLocation || contact.address;
            if (location) {
                icsContent += `LOCATION:${location.replace(/\n/g, ', ')}\n`;
            }
            
            icsContent += "END:VEVENT\n";
        });
    });

    icsContent += "END:VCALENDAR";
    return icsContent;
};

export const downloadICSFile = (content: string): void => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jobs-calendar.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Replaces placeholders in a template string with values from a data object.
 */
export const processTemplate = (template: string, data: Record<string, string>): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
};

let googleMapsPromise: Promise<void> | null = null;
let loadedApiKey: string | null = null;

/**
 * Loads the Google Maps API script, handling API key changes and auth errors.
 */
export const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error("Window not defined"));
  }

  const scriptId = 'google-maps-script';
  
  // If a script exists and the key is different, we need to reload.
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
  if (existingScript && !existingScript.src.includes(`key=${apiKey}`)) {
      existingScript.remove();
      (window as any).google = undefined;
      googleMapsPromise = null;
      loadedApiKey = null;
  }
  
  // If already loaded/loading with the correct key, return the existing promise.
  if (googleMapsPromise && loadedApiKey === apiKey) {
    return googleMapsPromise;
  }

  // If google object is already there with correct key, resolve immediately.
  if ((window as any).google && loadedApiKey === apiKey) {
    return Promise.resolve();
  }

  loadedApiKey = apiKey;
  googleMapsPromise = new Promise((resolve, reject) => {
    // Cleanup previous auth failure handler if it exists
    if ((window as any).gm_authFailure) {
        delete (window as any).gm_authFailure;
    }

    (window as any).gm_authFailure = () => {
      reject(new Error('Maps API Not Activated: Please enable the "Maps JavaScript API" in your Google Cloud Console for this project.'));
      delete (window as any).gm_authFailure;
    };

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      delete (window as any).gm_authFailure;
      resolve();
    };

    script.onerror = () => {
      googleMapsPromise = null;
      loadedApiKey = null;
      delete (window as any).gm_authFailure;
      reject(new Error('Failed to load Google Maps script. Please check your API key and network connection.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

/**
 * Calculates the SHA-256 hash of a file.
 * @param file The file to hash.
 * @returns A promise that resolves to the hex string of the hash.
 */
export const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

/**
 * Gets a date string in YYYY-MM-DD format from a Date object.
 */
export const getLocalDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Exports an array of objects to a CSV file.
 * @param data The array of objects to export.
 * @param filename The name of the file to download.
 */
export const exportToCsv = (data: Record<string, any>[], filename: string): void => {
    if (data.length === 0) {
        alert("No data available to export.");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
