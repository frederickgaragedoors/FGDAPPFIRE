
import React from 'react';
import { Contact } from '../types.ts';
import { getInitials } from '../utils.ts';
import { BriefcaseIcon, PlusIcon } from './icons.tsx';

interface ContactListItemProps {
  contact: Contact;
  isSelected: boolean;
  onSelect: () => void;
  onAddJob: () => void;
  index: number;
}

const ContactListItem: React.FC<ContactListItemProps> = ({ contact, isSelected, onSelect, onAddJob, index }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  // Determine background based on selection and index (alternating)
  let bgClass = '';
  if (isSelected) {
      bgClass = 'bg-sky-50 dark:bg-sky-900/40 border-l-4 border-sky-500 pl-3'; // Selected state with border accent
  } else {
      // Alternating backgrounds: White / Off-white
      bgClass = index % 2 === 0 
          ? 'bg-white dark:bg-slate-800 border-l-4 border-transparent pl-3' 
          : 'bg-slate-50 dark:bg-slate-800/50 border-l-4 border-transparent pl-3';
      // Hover effect
      bgClass += ' hover:bg-slate-100 dark:hover:bg-slate-700';
  }

  return (
    <li
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`flex items-center p-4 cursor-pointer transition-all duration-200 outline-none group ${bgClass}`}
    >
      <div className={`w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 ring-2 ring-offset-2 ${isSelected ? 'ring-sky-400 dark:ring-sky-600 ring-offset-sky-50 dark:ring-offset-slate-900' : 'ring-transparent ring-offset-transparent bg-slate-200 dark:bg-slate-700'}`}>
        {contact.photoUrl ? (
          <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-bold text-lg ${isSelected ? 'text-sky-700 dark:text-sky-200' : 'text-slate-500 dark:text-slate-400'}`}>
            {getInitials(contact.name)}
          </span>
        )}
      </div>
      <div className="ml-4 min-w-0 flex-grow">
        <div className="flex justify-between items-baseline">
             <p className={`font-semibold text-base truncate ${isSelected ? 'text-sky-900 dark:text-sky-100' : 'text-slate-800 dark:text-slate-200'}`}>
              {contact.name}
            </p>
            {contact.jobTickets && contact.jobTickets.length > 0 && (
                 <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${isSelected ? 'bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                    {contact.jobTickets.length} Job{contact.jobTickets.length !== 1 && 's'}
                 </span>
            )}
        </div>
       
        <p className={`text-sm truncate mt-0.5 ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
            {contact.email || contact.phone}
        </p>
      </div>

      {/* Quick Action Button - Visible on Hover */}
      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
        <button
            onClick={(e) => {
                e.stopPropagation();
                onAddJob();
            }}
            className="p-2 rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-400 dark:hover:bg-sky-800 transition-colors shadow-sm"
            title="Add New Job"
        >
            <div className="relative">
                <BriefcaseIcon className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full">
                    <PlusIcon className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400" />
                </div>
            </div>
        </button>
      </div>
    </li>
  );
};

export default ContactListItem;
