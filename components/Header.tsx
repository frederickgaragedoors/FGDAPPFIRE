import React, { useState, useRef, useEffect } from 'react';
import { ViewState } from '../types.ts';
import { PlusIcon, SettingsIcon, ClipboardListIcon, UsersIcon, CalendarIcon, MapIcon, CurrencyDollarIcon, ChartBarIcon, CarIcon, MegaphoneIcon, ChevronDownIcon } from './icons.tsx';

interface HeaderProps {
    currentView: ViewState['type'];
    onNewContact: () => void;
    onGoToSettings: () => void;
    onGoToDashboard: () => void;
    onGoToList: () => void;
    onGoToCalendar: () => void;
    onGoToRoute: () => void;
    onGoToExpenses: () => void;
    onGoToReports: () => void;
    onGoToMileage: () => void;
    onGoToSocial: () => void;
}

const Header: React.FC<HeaderProps> = ({
    currentView,
    onNewContact,
    onGoToSettings,
    onGoToDashboard,
    onGoToList,
    onGoToCalendar,
    onGoToRoute,
    onGoToExpenses,
    onGoToReports,
    onGoToMileage,
    onGoToSocial,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    const isDashboardActive = currentView === 'dashboard';
    const isCalendarActive = currentView === 'calendar';
    const isRouteActive = currentView === 'route';
    const isExpensesActive = currentView === 'expenses';
    const isReportsActive = currentView === 'reports';
    const isMileageActive = currentView === 'mileage';
    const isSocialActive = currentView === 'social';
    const isListActive = !isDashboardActive && !isCalendarActive && !isRouteActive && !isExpensesActive && !isReportsActive && !isMileageActive && !isSocialActive && currentView !== 'settings';

    const navItems = [
        { name: 'Dashboard', icon: ClipboardListIcon, action: onGoToDashboard, active: isDashboardActive },
        { name: 'Calendar', icon: CalendarIcon, action: onGoToCalendar, active: isCalendarActive },
        { name: 'Route', icon: MapIcon, action: onGoToRoute, active: isRouteActive },
        { name: 'Reports', icon: ChartBarIcon, action: onGoToReports, active: isReportsActive },
        { name: 'Mileage', icon: CarIcon, action: onGoToMileage, active: isMileageActive },
        { name: 'Expenses', icon: CurrencyDollarIcon, action: onGoToExpenses, active: isExpensesActive },
        { name: 'Social', icon: MegaphoneIcon, action: onGoToSocial, active: isSocialActive },
        { name: 'Contacts', icon: UsersIcon, action: onGoToList, active: isListActive },
    ];

    const activeItem = navItems.find(item => item.active) || navItems[0];
    const ActiveIcon = activeItem.icon;

    const buttonClass = (active: boolean) => 
        `flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            active 
            ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm' 
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
        }`;

    return (
        <header className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center space-x-2 bg-slate-50 dark:bg-slate-800 flex-shrink-0 z-20">
            
            {/* Mobile Dropdown Menu */}
            <div className="relative md:hidden" ref={menuRef}>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-base font-bold bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                    <ActiveIcon className="w-5 h-5 text-sky-500" />
                    <span>{activeItem.name}</span>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMenuOpen && (
                    <div className="absolute top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 animate-fadeIn">
                        <ul className="p-2">
                            {navItems.map(item => (
                                <li key={item.name}>
                                    <button
                                        onClick={() => {
                                            item.action();
                                            setIsMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium ${item.active ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                                    >
                                        <item.icon className={`w-5 h-5 ${item.active ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400'}`} />
                                        <span>{item.name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Desktop Horizontal Menu */}
            <div className="hidden md:flex items-center space-x-1 p-1 bg-slate-200 dark:bg-slate-900 rounded-lg overflow-x-auto no-scrollbar">
                {navItems.map(item => (
                    <button key={item.name} onClick={item.action} className={buttonClass(item.active)} aria-label={item.name}>
                        <item.icon className="w-5 h-5" />
                        <span className="hidden sm:inline">{item.name}</span>
                    </button>
                ))}
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                    onClick={onGoToSettings}
                    className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                    aria-label="Settings"
                >
                    <SettingsIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={onNewContact}
                    className="p-2 rounded-full text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                    aria-label="Add new contact"
                >
                    <PlusIcon className="w-6 h-6" />
                </button>
            </div>
        </header>
    );
};

export default Header;