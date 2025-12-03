

import React, { useState, useEffect, useMemo } from 'react';
import { useContacts } from '../contexts/ContactContext.tsx';
import ContactListItem from './ContactListItem.tsx';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from './icons.tsx';

interface ContactListProps {
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  onAddJob: (contactId: string) => void;
}

const ITEMS_PER_PAGE = 20;

const ContactList: React.FC<ContactListProps> = ({ 
    selectedContactId, 
    onSelectContact,
    onAddJob
}) => {
  const { contacts } = useContacts();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const sortedAndFilteredContacts = useMemo(() => {
    const sorted = (contacts || []).slice().sort((a, b) => {
        // Pinned items first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Then sort by lastModified date, descending
        const dateA = new Date(a.lastModified || 0).getTime();
        const dateB = new Date(b.lastModified || 0).getTime();
        return dateB - dateA;
    });

    const query = debouncedQuery.toLowerCase();
    if (!query) return sorted;

    return sorted.filter(contact => {
        const hasMatchingJobTicket = (contact.jobTickets || []).some(ticket =>
            ticket.id.toLowerCase().includes(query)
        );

        return (
            contact.name.toLowerCase().includes(query) ||
            (contact.email && contact.email.toLowerCase().includes(query)) ||
            (contact.phone && contact.phone.toLowerCase().includes(query)) ||
            (contact.address && contact.address.toLowerCase().includes(query)) ||
            hasMatchingJobTicket
        );
    });
  }, [contacts, debouncedQuery]);

  const { paginatedContacts, totalPages } = useMemo(() => {
    const totalPages = Math.ceil(sortedAndFilteredContacts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = sortedAndFilteredContacts.slice(startIndex, endIndex);
    return { paginatedContacts: paginated, totalPages };
  }, [sortedAndFilteredContacts, currentPage]);
  
  // Reset page when search query changes
  useEffect(() => {
      setCurrentPage(1);
  }, [debouncedQuery]);


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
        {paginatedContacts.length > 0 ? (
          paginatedContacts.map((contact, index) => (
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
       {totalPages > 1 && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 flex-shrink-0">
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Previous page"
            >
                <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Next page"
            >
                <ChevronRightIcon className="w-5 h-5" />
            </button>
        </div>
      )}
    </div>
  );
};

export default ContactList;