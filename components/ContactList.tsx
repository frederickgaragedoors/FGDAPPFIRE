
import React, { useState } from 'react';
import { Contact } from '../types.ts';
import ContactListItem from './ContactListItem.tsx';
import { SearchIcon } from './icons.tsx';

interface ContactListProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  onAddJob: (contactId: string) => void;
}

const ContactList: React.FC<ContactListProps> = ({ 
    contacts, 
    selectedContactId, 
    onSelectContact,
    onAddJob
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    const hasMatchingJobTicket = contact.jobTickets.some(ticket =>
      ticket.id.toLowerCase().includes(query)
    );

    return (
      contact.name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      (contact.address && contact.address.toLowerCase().includes(query)) ||
      hasMatchingJobTicket
    );
  });

  return (
    <div className="h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-5 h-5 text-slate-400" />
            </div>
            <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 transition-shadow"
            />
        </div>
      </div>
      <ul className="overflow-y-auto flex-grow divide-y divide-slate-100 dark:divide-slate-700/50">
        {filteredContacts.length > 0 ? (
          filteredContacts.map((contact, index) => (
            <ContactListItem
              key={contact.id}
              contact={contact}
              isSelected={contact.id === selectedContactId}
              onSelect={() => onSelectContact(contact.id)}
              onAddJob={() => onAddJob(contact.id)}
              index={index}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
             <p>No contacts found.</p>
          </div>
        )}
      </ul>
    </div>
  );
};

export default ContactList;
