import React, { useState, useEffect, useMemo } from 'react';
import { FirebaseUser as User, auth, isFirebaseConfigured } from './firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

import Header from './components/Header.tsx';
import ContactList from './components/ContactList.tsx';
import ContactDetail from './components/ContactDetail.tsx';
import ContactForm from './components/ContactForm.tsx';
import Settings from './components/Settings.tsx';
import Dashboard from './components/Dashboard.tsx';
import CalendarView from './components/CalendarView.tsx';
import InvoiceView from './components/InvoiceView.tsx';
import JobDetailView from './components/JobDetailView.tsx';
import ContactSelectorModal from './components/ContactSelectorModal.tsx';
import RouteView from './components/RouteView.tsx';
import ExpensesView from './components/ExpensesView.tsx';
import ReportsView from './components/ReportsView.tsx';
import MileageView from './components/MileageView.tsx';
import Login from './components/Login.tsx';
import LoadingOverlay from './components/LoadingOverlay.tsx';
import EmptyState from './components/EmptyState.tsx';
import { SettingsIcon, UsersIcon } from './components/icons.tsx';
import { AppProvider, useApp } from './contexts/AppContext.tsx';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext.tsx';
import { ContactProvider, useContacts } from './contexts/ContactContext.tsx';
import { FinanceProvider } from './contexts/FinanceContext.tsx';
import { MileageProvider } from './contexts/MileageContext.tsx';
import { ViewState } from './types.ts';


// Helper to create a unique trigger for date-based actions to prevent effect loops
const createDateTrigger = (date: string) => `${date}_${Date.now()}`;

const AppContent: React.FC = () => {
    const { 
        viewState, 
        setViewState,
        contactSelectorDate,
        setContactSelectorDate,
    } = useNavigation();
    const { contacts } = useContacts();

    const [newContactFormKey, setNewContactFormKey] = useState(Date.now());

    const fullScreenViews: ViewState['type'][] = ['dashboard', 'calendar', 'route', 'expenses', 'reports', 'mileage', 'settings'];
    const isFullScreenView = fullScreenViews.includes(viewState.type);

    const selectedContactId = useMemo(() => {
        if (viewState.type === 'detail' || viewState.type === 'edit_form') {
            return viewState.id;
        }
        if (viewState.type === 'invoice' || viewState.type === 'job_detail') {
            return viewState.contactId;
        }
        return null;
    }, [viewState]);

    const selectedContact = useMemo(() => {
        if (selectedContactId) {
            return contacts.find(c => c.id === selectedContactId) || null;
        }
        return null;
    }, [contacts, selectedContactId]);


    const renderView = () => {
        switch (viewState.type) {
            case 'dashboard': return <Dashboard onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} />;
            case 'calendar': return <CalendarView onAddJob={(date) => setContactSelectorDate(date)} onViewJob={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} />;
            case 'route': return <RouteView onGoToSettings={() => setViewState({ type: 'settings' })} onBack={() => setViewState({ type: 'dashboard' })} onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} initialDate={viewState.initialDate} />;
            case 'expenses': return <ExpensesView />;
            case 'reports': return <ReportsView />;
            case 'mileage': return <MileageView />;
            case 'list': 
                 return (
                    <div className="hidden md:flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
                        <EmptyState
                            Icon={UsersIcon}
                            title="Select a Contact"
                            message="Choose a contact from the list to see their details."
                        />
                    </div>
                );
            case 'detail':
                if (!selectedContact) return <div className="p-4">Contact not found</div>;
                return <ContactDetail key={selectedContact.id} contact={selectedContact} onEdit={() => setViewState({ type: 'edit_form', id: selectedContact.id })} onClose={() => setViewState({ type: 'list' })} onViewInvoice={(contactId, ticketId) => setViewState({ type: 'invoice', contactId, ticketId, from: 'contact_detail' })} onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} initialJobDate={viewState.initialJobDate} openJobId={viewState.openJobId} />;
            case 'new_form': return <ContactForm key={newContactFormKey} onCancel={() => setViewState({ type: 'list' })} initialJobDate={viewState.initialJobDate} />;
            case 'edit_form':
                if (!selectedContact) return <div className="p-4">Contact not found</div>;
                return <ContactForm key={selectedContact.id} initialContact={selectedContact} onCancel={() => setViewState({ type: 'detail', id: selectedContact.id })} />;
            case 'settings': 
                return <Settings onBack={() => setViewState({ type: 'dashboard' })} />;
            case 'invoice':
                return <InvoiceView contactId={viewState.contactId} ticketId={viewState.ticketId} from={viewState.from} onClose={() => setViewState(viewState.from === 'contact_detail' ? { type: 'detail', id: viewState.contactId } : { type: 'job_detail', contactId: viewState.contactId, ticketId: viewState.ticketId })} />;
            case 'job_detail':
                return <JobDetailView contactId={viewState.contactId} ticketId={viewState.ticketId} onBack={() => setViewState({ type: 'detail', id: viewState.contactId })} onViewInvoice={() => setViewState({ type: 'invoice', contactId: viewState.contactId, ticketId: viewState.ticketId, from: 'job_detail' })} onViewRouteForDate={(date) => setViewState({ type: 'route', initialDate: date })} />;
            default: return <Dashboard onViewJobDetail={(contactId, ticketId) => setViewState({ type: 'job_detail', contactId, ticketId })} />;
        }
    };

    const header = (
        <Header 
            currentView={viewState.type} 
            onNewContact={() => { setNewContactFormKey(Date.now()); setViewState({ type: 'new_form' }); }}
            onGoToSettings={() => setViewState({ type: 'settings' })}
            onGoToDashboard={() => setViewState({ type: 'dashboard' })}
            onGoToList={() => setViewState({ type: 'list' })}
            onGoToCalendar={() => setViewState({ type: 'calendar' })}
            onGoToRoute={() => setViewState({ type: 'route' })}
            onGoToExpenses={() => setViewState({ type: 'expenses' })}
            onGoToReports={() => setViewState({ type: 'reports' })}
            onGoToMileage={() => setViewState({ type: 'mileage' })}
        />
    );
     const modal = contactSelectorDate && (
        <ContactSelectorModal 
            onSelect={(contactId) => { 
                setViewState({ type: 'detail', id: contactId, initialJobDate: createDateTrigger(contactSelectorDate.toISOString().split('T')[0]) }); 
                setContactSelectorDate(null); 
            }} 
            onNewContact={() => { 
                setNewContactFormKey(Date.now());
                setViewState({ type: 'new_form', initialJobDate: createDateTrigger(contactSelectorDate.toISOString().split('T')[0]) }); 
                setContactSelectorDate(null); 
            }} 
            onClose={() => setContactSelectorDate(null)} 
            selectedDate={contactSelectorDate} 
        />
    );
    
    if (isFullScreenView) {
        return (
            <>
                <LoadingOverlay />
                {header}
                <main className="flex-grow overflow-hidden relative">{renderView()}</main>
                {modal}
            </>
        );
    }

    // Split screen view for contact related pages
    const showDetailPane = viewState.type !== 'list';
    
    return (
        <>
            <LoadingOverlay />
            {header}
            <main className="flex-grow overflow-hidden flex flex-row">
                 <div className={`
                    ${showDetailPane ? 'hidden' : 'flex'} w-full
                    md:flex md:w-[320px] lg:w-[384px] flex-shrink-0 h-full flex-col
                `}>
                    <ContactList
                        selectedContactId={selectedContactId}
                        onSelectContact={(id) => setViewState({ type: 'detail', id })}
                        onAddJob={(contactId) => setViewState({ type: 'detail', id: contactId, initialJobDate: createDateTrigger(new Date().toISOString().split('T')[0]) })}
                    />
                </div>
                <div className={`
                    ${showDetailPane ? 'flex' : 'hidden'} w-full
                    md:flex flex-grow h-full flex-col
                `}>
                    {renderView()}
                </div>
            </main>
            {modal}
        </>
    );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [configInput, setConfigInput] = useState('');

  useEffect(() => {
    const guestModePref = localStorage.getItem('isGuestMode') === 'true';
    if (guestModePref) {
      setIsGuestMode(true);
    }

    if (!isFirebaseConfigured || !auth) {
        setAuthLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (!guestModePref) {
            setUser(currentUser);
        }
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveConfig = () => {
      const config: Record<string, string> = Object.fromEntries(
        configInput.split('\n')
          .map(line => line.split('='))
          .filter(parts => parts.length >= 2)
          .map(([key, ...val]) => [key.trim(), val.join('=').split('#')[0].trim().replace(/^["']|["',;]$/g, '')])
          .filter(([key, value]) => key && value)
      );
      localStorage.setItem('firebase_config_override', JSON.stringify(config));
      window.location.reload();
  };

  const setGuestModeAndReload = (isGuest: boolean) => {
    localStorage.setItem('isGuestMode', String(isGuest));
    setIsGuestMode(isGuest);
    if(isGuest) {
      window.location.reload();
    } else {
      setUser(null); // Force re-auth
    }
  }

  if (!isFirebaseConfigured && !isGuestMode) {
      return (
          <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-lg w-full border border-slate-200 dark:border-slate-700">
                  <div className="text-center">
                    <SettingsIcon className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto" />
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">App Setup</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Enter Firebase keys to sync data, or continue as a guest to store data locally.</p>
                  </div>
                  <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Paste .env content (API Keys):</label>
                      <textarea value={configInput} onChange={(e) => setConfigInput(e.target.value)}
                          className="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-xs bg-slate-50 dark:bg-slate-900"
                          placeholder="VITE_FIREBASE_API_KEY=AIza..." />
                  </div>
                  <button onClick={handleSaveConfig} className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-md font-medium transition-colors shadow-sm mb-3">
                      Save Keys & Restart
                  </button>
                  <button onClick={() => setGuestModeAndReload(true)} className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-medium transition-colors shadow-sm">
                      Continue as Guest
                  </button>
              </div>
          </div>
      );
  }

  if (authLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500">Loading...</div>;
  }

  if (!user && !isGuestMode) {
      return <Login onGuestLogin={() => setGuestModeAndReload(true)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
       <style>{`
        .pac-container {
            z-index: 99999 !important;
        }
      `}</style>
      <AppProvider user={user} isGuestMode={isGuestMode} onSwitchToCloud={() => setGuestModeAndReload(false)}>
        <NavigationProvider>
            <ContactProvider>
                <FinanceProvider>
                    <MileageProvider>
                        <AppContent />
                    </MileageProvider>
                </FinanceProvider>
            </ContactProvider>
        </NavigationProvider>
      </AppProvider>
    </div>
  );
}

export default App;
