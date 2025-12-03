import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ViewState } from '../types.ts';

interface NavigationContextType {
    viewState: ViewState;
    setViewState: (viewState: ViewState) => void;
    contactSelectorDate: Date | null;
    setContactSelectorDate: (date: Date | null) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) throw new Error('useNavigation must be used within a NavigationProvider');
    return context;
};

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
    const [contactSelectorDate, setContactSelectorDate] = useState<Date | null>(null);

    const value = {
        viewState,
        setViewState,
        contactSelectorDate,
        setContactSelectorDate,
    };

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
