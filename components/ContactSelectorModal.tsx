
import React, { useState } from 'react';
import { Contact } from '../types.ts';
import { SearchIcon, PlusIcon, XIcon, UserCircleIcon } from './icons.tsx';
import { getInitials } from '../utils.ts';

interface ContactSelectorModalProps {
  contacts: Contact[];
  onSelect: (contactId: string) => void;
  onNewContact: () => void;
  onClose: () => void;
  selectedDate: Date;
}

const ContactSelectorModal: React.FC<ContactSelectorModalProps> = ({ contacts, onSelect, onNewContact, onClose, selectedDate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
             Add Job for {selectedDate.toLocaleDateString()}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="w-5 h-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                />
            </div>
        </div>

        <ul className="overflow-y-auto flex-grow p-2 space-y-1">
             <li>
                <button
                    onClick={onNewContact}
                    className="w-full flex items-center p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left group"
                >
                    <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-300 group-hover:bg-sky-200 dark:group-hover:bg-sky-800">
                        <PlusIcon className="w-6 h-6" />
                    </div>
                    <div className="ml-3">
                         <p className="font-semibold text-slate-800 dark:text-slate-100">Create New Contact</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Add a new client for this job</p>
                    </div>
                </button>
            </li>
            {filteredContacts.map(contact => (
                <li key={contact.id}>
                    <button
                        onClick={() => onSelect(contact.id)}
                        className="w-full flex items-center p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-300 dark:bg-slate-600 flex-shrink-0 flex items-center justify-center">
                            {contact.photoUrl ? (
                                <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-slate-600 dark:text-slate-300 font-semibold text-sm">{getInitials(contact.name)}</span>
                            )}
                        </div>
                        <div className="ml-3 truncate">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{contact.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contact.email || contact.phone}</p>
                        </div>
                    </button>
                </li>
            ))}
             {filteredContacts.length === 0 && searchQuery && (
                <li className="p-4 text-center text-slate-500 dark:text-slate-400">
                    No contacts found.
                </li>
            )}
        </ul>
      </div>
    </div>
  );
};

export default ContactSelectorModal;
