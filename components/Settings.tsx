import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, EmailSettings, CatalogItem, DEFAULT_ON_MY_WAY_TEMPLATE, MapSettings, Theme, CategorizationRule, ExpenseCategory, ALL_EXPENSE_CATEGORIES, Supplier, AiSettings } from '../types.ts';
import { ArrowLeftIcon, TrashIcon, PlusIcon, DownloadIcon, UploadIcon, UserCircleIcon, EditIcon, CalendarIcon, ChevronDownIcon, MapPinIcon, BuildingStorefrontIcon, SparklesIcon } from './icons.tsx';
import { saveJsonFile, fileToDataUrl, generateICSContent, downloadICSFile, generateId } from '../utils.ts';
import JobTemplateModal from './JobTemplateModal.tsx';
import { useGoogleMaps } from '../hooks/useGoogleMaps.ts';
import { useContacts } from '../contexts/ContactContext.tsx';
import { useFinance } from '../contexts/FinanceContext.tsx';
import { useMileage } from '../contexts/MileageContext.tsx';
import { useApp } from '../contexts/AppContext.tsx';
import { useNotifications } from '../contexts/NotificationContext.tsx';
import { auth } from '../firebase.ts';
import { signOut } from 'firebase/auth';
import ConfirmationModal from './ConfirmationModal.tsx';

// Declare google for TS
declare const google: any;

const SettingsSection = ({ title, subtitle, children, defaultOpen = false }: { title: string, subtitle?: string, children?: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-t dark:border-slate-700">
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between py-4 text-left focus:outline-none group"
        >
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{title}</h3>
                {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                 <ChevronDownIcon className="w-5 h-5 text-slate-400 group-hover:text-sky-500" />
            </div>
        </button>
        {isOpen && (
            <div className="pb-6 animate-fadeIn">
                {children}
            </div>
        )}
    </div>
  );
}

interface SettingsProps {
    onBack: () => void;
}

const RULE_CATEGORIES = ALL_EXPENSE_CATEGORIES.filter(c => c !== 'Uncategorized' && c !== 'Mileage');

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { contacts, restoreContacts } = useContacts();
    const { expenses, bankTransactions, bankStatements, restoreFinanceData, handleDeleteAllBankData } = useFinance();
    const { mileageLogs, restoreMileageLogs } = useMileage();
    const {
        defaultFields,
        businessInfo,
        emailSettings,
        jobTemplates,
        partsCatalog,
        enabledStatuses,
        showContactPhotos,
        mapSettings,
        aiSettings,
        routes,
        user,
        saveSettings,
        isGuestMode,
        onSwitchToCloud,
        theme,
        setTheme,
        categorizationRules,
        handleSaveCategorizationRules,
    } = useApp();
    const { addNotification } = useNotifications();

    const appStateForBackup = useMemo(() => ({
        contacts,
        expenses,
        bankTransactions,
        bankStatements,
        mileageLogs,
        settings: {
            defaultFields,
            businessInfo,
            emailSettings,
            jobTemplates,
            partsCatalog,
            enabledStatuses,
            mapSettings: { homeAddress: mapSettings.homeAddress, apiKey: mapSettings.apiKey },
            aiSettings: { geminiApiKey: aiSettings.geminiApiKey }, // Include AI settings
            showContactPhotos,
            routes,
        },
        categorizationRules,
        version: '1.0'
    }), [
        contacts, expenses, bankTransactions, bankStatements, mileageLogs,
        defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, mapSettings, aiSettings, showContactPhotos, routes, categorizationRules
    ]);

    const restoreBackup = useCallback(async (backupContent: string) => {
        const backupData = JSON.parse(backupContent);
        if (!backupData.version || !backupData.contacts || !backupData.settings) {
            throw new Error("Invalid or corrupted backup file.");
        }
        await restoreContacts(backupData.contacts || []);
        await restoreFinanceData({
            expenses: backupData.expenses || [],
            bankTransactions: backupData.bankTransactions || [],
            bankStatements: backupData.bankStatements || [],
        });
        await restoreMileageLogs(backupData.mileageLogs || []);
        await saveSettings(backupData.settings || {});
        await handleSaveCategorizationRules(backupData.categorizationRules || []);
    }, [restoreContacts, restoreFinanceData, restoreMileageLogs, saveSettings, handleSaveCategorizationRules]);
    
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [currentBusinessInfo, setCurrentBusinessInfo] = useState<BusinessInfo>(businessInfo);
    const [currentEmailSettings, setCurrentEmailSettings] = useState<EmailSettings>(emailSettings);
    const [currentMapSettings, setCurrentMapSettings] = useState<MapSettings>(mapSettings);
    const [currentAiSettings, setCurrentAiSettings] = useState<AiSettings>(aiSettings);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
    const [newCatalogItemName, setNewCatalogItemName] = useState('');
    const [newCatalogItemCost, setNewCatalogItemCost] = useState<number | ''>('');
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
    const [isClearBankDataConfirmOpen, setIsClearBankDataConfirmOpen] = useState(false);
    const [currentRules, setCurrentRules] = useState<CategorizationRule[]>([]);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierAddress, setNewSupplierAddress] = useState('');
    const [newRuleKeyword, setNewRuleKeyword] = useState('');
    const [newRuleCategory, setNewRuleCategory] = useState<ExpenseCategory>('Other');

    const homeAddressRef = useRef<HTMLInputElement>(null);
    const supplierAddressRef = useRef<HTMLInputElement>(null);
    const { isLoaded: isMapsLoaded } = useGoogleMaps(mapSettings.apiKey);

    const updateTheme = (newTheme: Theme) => {
        setTheme(newTheme);
    };

    // Sync local state when props change
    useEffect(() => { setCurrentBusinessInfo(businessInfo) }, [businessInfo]);
    useEffect(() => { setCurrentEmailSettings(emailSettings) }, [emailSettings]);
    useEffect(() => { setCurrentMapSettings(mapSettings) }, [mapSettings]);
    useEffect(() => { setCurrentAiSettings(aiSettings) }, [aiSettings]);
    useEffect(() => { setCurrentRules(categorizationRules || []) }, [categorizationRules]);


    // Initialize Google Maps Autocomplete
    useEffect(() => {
        if (isMapsLoaded && (window as any).google && (window as any).google.maps) {
            if (homeAddressRef.current) {
                const autocomplete = new (window as any).google.maps.places.Autocomplete(homeAddressRef.current);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    handleMapSettingsChange('homeAddress', place.formatted_address || place.name || '');
                });
            }
            if (supplierAddressRef.current) {
                const autocomplete = new (window as any).google.maps.places.Autocomplete(supplierAddressRef.current);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    setNewSupplierAddress(place.formatted_address || place.name || '');
                });
            }
        }
    }, [isMapsLoaded]);

    const handleDefaultFieldSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFieldLabel.trim()) {
            const newFields = [...defaultFields, { id: generateId(), label: newFieldLabel.trim() }];
            saveSettings({ defaultFields: newFields });
            setNewFieldLabel('');
            addNotification('Default field added.', 'success');
        }
    };
    
    const handleDeleteDefaultField = (id: string) => {
        const newFields = defaultFields.filter(f => f.id !== id);
        saveSettings({ defaultFields: newFields });
        addNotification('Default field deleted.', 'success');
    };
    
    const handleBusinessInfoChange = (field: keyof BusinessInfo, value: any) => {
        setCurrentBusinessInfo(prev => ({ ...prev, [field]: value }));
    };
    
    const handleEmailSettingsChange = (type: 'estimate' | 'receipt', field: 'subject' | 'body', value: string) => {
        setCurrentEmailSettings(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    };

    const handleMapSettingsChange = (field: keyof MapSettings, value: string) => {
        setCurrentMapSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleAiSettingsChange = (field: keyof AiSettings, value: string) => {
        setCurrentAiSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const dataUrl = await fileToDataUrl(e.target.files[0]);
            handleBusinessInfoChange('logoUrl', dataUrl);
        }
    };

    const handleBusinessInfoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveSettings({ businessInfo: currentBusinessInfo });
        addNotification('Business info saved.', 'success');
    };

    const handleEmailSettingsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveSettings({ emailSettings: currentEmailSettings, businessInfo: currentBusinessInfo });
        addNotification('Communication templates saved.', 'success');
    };

    const handleMapSettingsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveSettings({ mapSettings: currentMapSettings });
        addNotification('Map settings saved.', 'success');
    };

    const handleAiSettingsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveSettings({ aiSettings: currentAiSettings });
        addNotification('AI settings saved.', 'success');
    };
    
    const handleManualBackup = async () => {
        const timestamp = new Date().toISOString().slice(0, 10);
        await saveJsonFile(appStateForBackup, `contacts-backup-${timestamp}.json`);
    };
    
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                if (content) {
                    setRestoreFileContent(content);
                    setIsRestoreConfirmOpen(true);
                }
            };
            reader.readAsText(file);
        }
        if (e.target) e.target.value = '';
    };
    
    const handleConfirmRestore = async () => {
        if (restoreFileContent) {
            try {
                await restoreBackup(restoreFileContent);
                addNotification('Backup restored successfully!', 'success');
            } catch (error: any) {
                addNotification(error.message || 'Failed to restore backup.', 'error');
            }
        }
        setIsRestoreConfirmOpen(false);
        setRestoreFileContent(null);
    };

    const handleSaveTemplate = (templateData: Omit<JobTemplate, 'id'> & { id?: string }) => {
        let newTemplates;
        if (templateData.id) {
            newTemplates = jobTemplates.map(jt => jt.id === templateData.id ? { ...templateData, id: templateData.id } : jt);
        } else {
            newTemplates = [...jobTemplates, { ...templateData, id: generateId() }];
        }
        saveSettings({ jobTemplates: newTemplates });
        setIsTemplateModalOpen(false);
        setEditingTemplate(null);
        addNotification('Job template saved.', 'success');
    };

    const handleDeleteJobTemplate = (id: string) => {
        const newTemplates = jobTemplates.filter(jt => jt.id !== id);
        saveSettings({ jobTemplates: newTemplates });
        addNotification('Job template deleted.', 'success');
    };

    const handleAddCatalogItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCatalogItemName.trim()) {
            const newCatalog = [...partsCatalog, { id: generateId(), name: newCatalogItemName.trim(), defaultCost: Number(newCatalogItemCost || 0) }];
            saveSettings({ partsCatalog: newCatalog });
            setNewCatalogItemName('');
            setNewCatalogItemCost('');
            addNotification('Part added to catalog.', 'success');
        }
    };
    
    const handleDeleteCatalogItem = (id: string) => {
        const newCatalog = partsCatalog.filter(i => i.id !== id);
        saveSettings({ partsCatalog: newCatalog });
        addNotification('Part deleted from catalog.', 'success');
    };
    
    const handleToggleJobStatus = (status: JobStatus, enabled: boolean) => {
        const newStatuses = { ...enabledStatuses, [status]: enabled };
        saveSettings({ enabledStatuses: newStatuses });
    };

    const handleToggleShowContactPhotos = (enabled: boolean) => {
        saveSettings({ showContactPhotos: enabled });
    };
    
    const handleExportCalendar = () => {
        const icsContent = generateICSContent(contacts);
        downloadICSFile(icsContent);
    };
    
    const handleSignOut = () => {
        if (auth) {
            signOut(auth).catch(error => console.error("Sign out error", error));
        }
    };
    
    const handleAddRule = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRuleKeyword.trim()) return;
        const newRule: CategorizationRule = {
            id: generateId(),
            keyword: newRuleKeyword.trim(),
            category: newRuleCategory,
        };
        setCurrentRules(prev => [...prev, newRule]);
        setNewRuleKeyword('');
        setNewRuleCategory('Other');
    };

    const handleDeleteRule = (id: string) => {
        setCurrentRules(prev => prev.filter(rule => rule.id !== id));
    };

    const handleSaveRules = () => {
        handleSaveCategorizationRules(currentRules);
        addNotification('Categorization rules saved!', 'success');
    };
    
    const handleAddSupplier = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSupplierName.trim() && newSupplierAddress.trim()) {
            const newSupplier: Supplier = { id: generateId(), name: newSupplierName, address: newSupplierAddress };
            const updatedSuppliers = [...(currentBusinessInfo.suppliers || []), newSupplier];
            handleBusinessInfoChange('suppliers', updatedSuppliers);
            setNewSupplierName('');
            setNewSupplierAddress('');
        }
    };

    const handleDeleteSupplier = (id: string) => {
        const updatedSuppliers = (currentBusinessInfo.suppliers || []).filter(s => s.id !== id);
        handleBusinessInfoChange('suppliers', updatedSuppliers);
    };

    const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:text-white";
    const labelStyles = "block text-sm font-medium text-slate-600 dark:text-slate-300";

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800 overflow-y-auto">
             <div className="p-4 flex items-center border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden">
                    <ArrowLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>
                <h2 className="ml-4 flex-grow font-bold text-lg text-slate-700 dark:text-slate-200">
                  Settings
                </h2>
                <button type="button" onClick={onBack} className="hidden md:inline px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Back</button>
            </div>
            <div className="px-4 sm:px-6 py-6 flex-grow">
                
                {/* Account Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Account</h3>
                    <div className="mt-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-200 dark:border-slate-600">
                        {isGuestMode ? (
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                                    <UserCircleIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Guest Mode</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Data is stored locally.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-4 min-w-0">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                                        <UserCircleIcon className="w-8 h-8" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900 dark:text-white truncate">{user?.displayName || 'User'}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{user?.email}</p>
                                </div>
                            </div>
                        )}
                        
                        {isGuestMode ? (
                            <button 
                                onClick={onSwitchToCloud}
                                className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-md transition-colors w-full sm:w-auto"
                            >
                                Sign In & Sync
                            </button>
                        ) : (
                            <button 
                                onClick={handleSignOut}
                                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors w-full sm:w-auto"
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                </div>

                 <div className="mb-8">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Appearance</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose how the app looks.</p>
                     <div className="mt-6 flex space-x-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        {(['Light', 'Dark', 'System'] as const).map(themeOption => (
                            <button
                                key={themeOption}
                                onClick={() => updateTheme(themeOption.toLowerCase() as Theme)}
                                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${theme === themeOption.toLowerCase() ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                            >
                                {themeOption}
                            </button>
                        ))}
                    </div>
                </div>

                <SettingsSection title="Display Preferences" subtitle="Customize the application layout.">
                    <div className="mt-2 space-y-3">
                         <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">Show Contact Photos</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Display profile pictures on the contact details page.</p>
                            </div>
                            <button
                                onClick={() => handleToggleShowContactPhotos(!showContactPhotos)}
                                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${showContactPhotos ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${showContactPhotos ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </SettingsSection>
                
                <SettingsSection title="Business Information" subtitle="This info will appear on your estimates and receipts.">
                     <form onSubmit={handleBusinessInfoSubmit}>
                        <div className="mt-2 space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className="w-48 h-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600">
                                    {currentBusinessInfo.logoUrl ? (
                                        <img src={currentBusinessInfo.logoUrl} alt="Business Logo" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <UserCircleIcon className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                                    )}
                                </div>
                                <label htmlFor="logo-upload" className="cursor-pointer text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900 px-3 py-2 rounded-md">
                                    Change Logo
                                    <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                </label>
                            </div>
                            <div>
                                <label htmlFor="business-name" className={labelStyles}>Company Name</label>
                                <input type="text" id="business-name" value={currentBusinessInfo.name} onChange={e => handleBusinessInfoChange('name', e.target.value)} className={inputStyles} />
                            </div>
                             <div>
                                <label htmlFor="business-phone" className={labelStyles}>Phone</label>
                                <input type="tel" id="business-phone" value={currentBusinessInfo.phone} onChange={e => handleBusinessInfoChange('phone', e.target.value)} className={inputStyles} />
                            </div>
                             <div>
                                <label htmlFor="business-email" className={labelStyles}>Email</label>
                                <input type="email" id="business-email" value={currentBusinessInfo.email} onChange={e => handleBusinessInfoChange('email', e.target.value)} className={inputStyles} />
                            </div>
                            <div>
                                <label htmlFor="business-address" className={labelStyles}>Address</label>
                                <textarea id="business-address" value={currentBusinessInfo.address} onChange={e => handleBusinessInfoChange('address', e.target.value)} rows={3} className={inputStyles}></textarea>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="default-tax" className={labelStyles}>Default Sales Tax (%)</label>
                                    <input type="number" id="default-tax" value={currentBusinessInfo.defaultSalesTaxRate || ''} onChange={e => handleBusinessInfoChange('defaultSalesTaxRate', parseFloat(e.target.value))} step="0.01" className={inputStyles} placeholder="0.00" />
                                </div>
                                <div>
                                    <label htmlFor="default-fee" className={labelStyles}>Default Card Fee (%)</label>
                                    <input type="number" id="default-fee" value={currentBusinessInfo.defaultProcessingFeeRate || ''} onChange={e => handleBusinessInfoChange('defaultProcessingFeeRate', parseFloat(e.target.value))} step="0.01" className={inputStyles} placeholder="0.00" />
                                </div>
                            </div>
                        </div>
                         <button type="submit" className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save Business Info</button>
                    </form>
                </SettingsSection>
                
                <SettingsSection title="My Suppliers" subtitle="Manage addresses for parts suppliers.">
                    <form onSubmit={handleAddSupplier} className="mt-2 flex gap-2 items-end">
                        <div className="flex-grow"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Supplier Name</label><input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="e.g., Main Street Supply" className={inputStyles} /></div>
                        <div className="flex-grow">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Address</label>
                            <input ref={supplierAddressRef} type="text" value={newSupplierAddress} onChange={e => setNewSupplierAddress(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') e.preventDefault(); }} placeholder="123 Industrial Way" className={inputStyles} autoComplete="off" />
                        </div>
                        <button type="submit" className="mb-[1px] inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"><PlusIcon className="w-5 h-5" /></button>
                    </form>
                    <div className="mt-6 border-t dark:border-slate-700 pt-4">
                        {(currentBusinessInfo.suppliers || []).length > 0 ? (
                            <ul className="space-y-2">
                                {(currentBusinessInfo.suppliers || []).map(supplier => (
                                    <li key={supplier.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center">
                                            <BuildingStorefrontIcon className="w-6 h-6 text-slate-500 dark:text-slate-400 mr-4"/>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-slate-100">{supplier.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.address}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">No suppliers added yet.</p>
                        )}
                    </div>
                     <button onClick={handleBusinessInfoSubmit} className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save Suppliers</button>
                </SettingsSection>

                <SettingsSection title="Map & Route Settings" subtitle="Configure your starting location for routing.">
                    <form onSubmit={handleMapSettingsSubmit}>
                        <div className="mt-2 space-y-4">
                            <div>
                                <label htmlFor="home-address" className={labelStyles}>Home / Base Address</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Used as the starting and ending point for your daily routes.</p>
                                <input ref={homeAddressRef} type="text" id="home-address" value={currentMapSettings.homeAddress || ''} onChange={e => handleMapSettingsChange('homeAddress', e.target.value)} onKeyDown={e => { if(e.key === 'Enter') e.preventDefault(); }} className={inputStyles} placeholder="e.g. 123 Warehouse Blvd, Springfield" autoComplete="off" />
                            </div>
                             <div>
                                <label htmlFor="mileage-rate" className={labelStyles}>Standard Mileage Rate ($ per mile)</label>
                                <input type="number" id="mileage-rate" value={currentBusinessInfo.standardMileageRate || ''} onChange={e => handleBusinessInfoChange('standardMileageRate', parseFloat(e.target.value))} step="0.001" className={inputStyles} placeholder="e.g. 0.655" />
                            </div>
                             <div>
                                <label htmlFor="maps-api-key" className={labelStyles}>Google Maps API Key</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Required for address autocomplete and route planning.</p>
                                <input 
                                    type="password" 
                                    id="maps-api-key" 
                                    value={currentMapSettings.apiKey || ''} 
                                    onChange={e => handleMapSettingsChange('apiKey', e.target.value)} 
                                    className={inputStyles} 
                                    placeholder="Enter your Google Maps API Key"
                                />
                                 <a href="https://console.cloud.google.com/google/maps-apis/api-list" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-1 inline-block">
                                    Get an API Key &rarr;
                                </a>
                                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600">
                                    <p className="font-semibold mb-1 text-slate-600 dark:text-slate-300">Required APIs:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Maps JavaScript API (for the map view)</li>
                                        <li>Places API (for address autocomplete)</li>
                                        <li>Directions API (for route planning)</li>
                                    </ul>
                                </div>
                                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 space-y-3">
                                    <p className="font-bold text-sm">Facing "Referer Not Allowed" Errors? Read This.</p>
                                    
                                    <div className="p-3 bg-white dark:bg-slate-800/50 rounded-md border border-amber-200 dark:border-amber-800">
                                        <p className="font-semibold mb-2 text-amber-900 dark:text-amber-100">The Problem with Desktop Apps</p>
                                        <p className="text-[11px] leading-relaxed">
                                            This desktop application runs locally from a special <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/50 p-0.5 rounded">file://</code> address. For security, Google Maps does not allow these addresses to be authorized. While whitelisting <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/50 p-0.5 rounded">http://localhost:3001/*</code> is a common workaround, it is often unreliable in packaged desktop apps.
                                        </p>
                                    </div>

                                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                                        <p className="font-semibold mb-2 text-green-900 dark:text-green-200">Recommended Solution for This Desktop App</p>
                                        <p className="text-[11px] leading-relaxed text-green-800 dark:text-green-300">
                                            The most reliable fix is to create a <strong>separate, unrestricted API key</strong> used <em>only</em> for this application.
                                        </p>
                                        <ol className="list-decimal list-inside text-[11px] mt-2 space-y-1 text-green-700 dark:text-green-400">
                                            <li>Go to the Google Cloud Console &gt; Credentials.</li>
                                            <li>Click <strong>CREATE CREDENTIALS</strong> &gt; <strong>API Key</strong>.</li>
                                            <li>Name it something clear, like "Business Contacts Desktop Key".</li>
                                            <li>Under "Application restrictions", select <strong>None</strong>. Click Save.</li>
                                            <li><strong>Important Security:</strong> Since this key is unrestricted, go to "Billing" and <a href="https://cloud.google.com/billing/docs/how-to/budgets" target="_blank" rel="noopener noreferrer" className="font-bold underline">set up billing alerts</a> to prevent unexpected charges.</li>
                                            <li>Copy your new, unrestricted key and paste it into the field above.</li>
                                        </ol>
                                    </div>
                                    
                                    <p className="text-center text-[10px] text-amber-600 dark:text-amber-400 pt-2">
                                        <strong>For Web Deployments:</strong> Use a <em>different</em>, restricted key and add your website URL (e.g., <code className="font-mono">your-app.vercel.app/*</code>) to its "Website restrictions".
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save Map Settings</button>
                    </form>
                </SettingsSection>

                <SettingsSection title="AI Services" subtitle="Configure API keys for AI-powered features.">
                    <form onSubmit={handleAiSettingsSubmit}>
                        <div className="mt-2 space-y-4">
                            <div>
                                <label htmlFor="gemini-api-key" className={labelStyles}>Gemini API Key</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Required for Social Media post generation and other AI features.</p>
                                <input 
                                    type="password" 
                                    id="gemini-api-key" 
                                    value={currentAiSettings.geminiApiKey || ''} 
                                    onChange={e => handleAiSettingsChange('geminiApiKey', e.target.value)} 
                                    className={inputStyles} 
                                    placeholder="Enter your Gemini API Key"
                                />
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-1 inline-block">
                                    Get a Gemini API Key &rarr;
                                </a>
                                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 space-y-2">
                                    <p className="font-bold text-sm">Getting Quota Errors (429)?</p>
                                    <p className="text-[11px] leading-relaxed">
                                        Advanced AI features like image generation often require a Google Cloud project with billing enabled, even if you stay within the free tier. This is to prevent abuse. If you see a "Quota Exceeded" error with a limit of `0`, it means this feature is not active for your key.
                                    </p>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                                        <p className="font-semibold text-sm mb-2 text-green-900 dark:text-green-200">Solution</p>
                                         <ol className="list-decimal list-inside text-[11px] space-y-1 text-green-700 dark:text-green-400">
                                            <li>Ensure your API key is from a project in the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline">Google Cloud Console</a>.</li>
                                            <li>Navigate to the <strong>Billing</strong> section for that project.</li>
                                            <li>Make sure a valid billing account is linked. This is required to use most multimodal models.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save AI Settings</button>
                    </form>
                </SettingsSection>

                <SettingsSection title="Auto-Categorization Rules" subtitle="Automatically categorize imported bank transactions.">
                    <form onSubmit={handleAddRule} className="mt-2 flex gap-2 items-end">
                        <div className="flex-grow"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Keyword</label><input type="text" value={newRuleKeyword} onChange={(e) => setNewRuleKeyword(e.target.value)} placeholder="e.g. Home Depot" className={inputStyles} /></div>
                        <div className="flex-grow">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
                            <select value={newRuleCategory} onChange={e => setNewRuleCategory(e.target.value as ExpenseCategory)} className={inputStyles}>
                                {RULE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="mb-[1px] inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"><PlusIcon className="w-5 h-5" /></button>
                    </form>

                     <div className="mt-6 border-t dark:border-slate-700 pt-4">
                        {currentRules.length > 0 ? (
                            <ul className="space-y-2">
                                {currentRules.map(rule => (
                                    <li key={rule.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{rule.keyword}</p>
                                            <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">{rule.category}</p>
                                        </div>
                                        <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">No rules created yet.</p>
                        )}
                    </div>
                     <button onClick={handleSaveRules} className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save Rules</button>
                </SettingsSection>
                
                <SettingsSection title="Communication Templates" subtitle="Configure default messages for SMS and Emails.">
                     <form onSubmit={handleEmailSettingsSubmit}>
                        <div className="mt-2 space-y-6">
                            <div>
                                <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3">"On My Way" SMS</h4>
                                <div>
                                    <label className={labelStyles}>Message Body</label>
                                    <textarea value={currentBusinessInfo.onMyWayTemplate || DEFAULT_ON_MY_WAY_TEMPLATE} onChange={e => handleBusinessInfoChange('onMyWayTemplate', e.target.value)} rows={3} className={inputStyles}></textarea>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3">Estimate Email</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className={labelStyles}>Subject</label>
                                        <input type="text" value={currentEmailSettings.estimate.subject} onChange={e => handleEmailSettingsChange('estimate', 'subject', e.target.value)} className={inputStyles} />
                                    </div>
                                    <div>
                                        <label className={labelStyles}>Body</label>
                                        <textarea value={currentEmailSettings.estimate.body} onChange={e => handleEmailSettingsChange('estimate', 'body', e.target.value)} rows={4} className={inputStyles}></textarea>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3">Receipt Email</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className={labelStyles}>Subject</label>
                                        <input type="text" value={currentEmailSettings.receipt.subject} onChange={e => handleEmailSettingsChange('receipt', 'subject', e.target.value)} className={inputStyles} />
                                    </div>
                                    <div>
                                        <label className={labelStyles}>Body</label>
                                        <textarea value={currentEmailSettings.receipt.body} onChange={e => handleEmailSettingsChange('receipt', 'body', e.target.value)} rows={4} className={inputStyles}></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors">Save Templates</button>
                    </form>
                </SettingsSection>

                 <SettingsSection title="Job Status Visibility" subtitle="Choose which statuses appear in the dropdown menu.">
                    <div className="mt-2 space-y-3">
                         {ALL_JOB_STATUSES.filter(s => s !== 'Job Created').map((status) => (
                            <div key={status} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{status}</span>
                                <button
                                    onClick={() => handleToggleJobStatus(status, !enabledStatuses[status])}
                                    className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${enabledStatuses[status] ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${enabledStatuses[status] ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                         ))}
                    </div>
                </SettingsSection>

                <SettingsSection title="Manage Default Fields" subtitle="These fields will be automatically added to any new contact.">
                    <form onSubmit={handleDefaultFieldSubmit} className="mt-2 flex space-x-2">
                        <input type="text" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Birthday" className="flex-grow block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                        <button type="submit" className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"><PlusIcon className="w-5 h-5" /></button>
                    </form>

                    <div className="mt-6 border-t dark:border-slate-700 pt-4">
                        {defaultFields.length > 0 ? (
                            <ul className="space-y-2">
                                {defaultFields.map(field => (
                                    <li key={field.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{field.label}</span>
                                        <button onClick={() => handleDeleteDefaultField(field.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors" aria-label={`Delete ${field.label} field`}><TrashIcon className="w-5 h-5" /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">No default fields have been set.</p>
                        )}
                    </div>
                </SettingsSection>

                <SettingsSection title="Manage Job Templates" subtitle="Create reusable templates for common jobs to save time.">
                    <div className="mt-2">
                        <button type="button" onClick={() => { setEditingTemplate(null); setIsTemplateModalOpen(true); }} className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"><PlusIcon className="w-5 h-5 mr-2" />Create New Template</button>
                    </div>
                    <div className="mt-4 border-t dark:border-slate-700 pt-4">
                        {jobTemplates.length > 0 ? (
                            <ul className="space-y-2">
                                {jobTemplates.map(template => (
                                    <li key={template.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{template.name}</span>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => { setEditingTemplate(template); setIsTemplateModalOpen(true); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-full transition-colors" aria-label={`Edit ${template.name} template`}><EditIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleDeleteJobTemplate(template.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors" aria-label={`Delete ${template.name} template`}><TrashIcon className="w-5 h-5" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">No job templates have been created.</p>
                        )}
                    </div>
                </SettingsSection>
                
                <SettingsSection title="Parts Catalog" subtitle="Manage common parts and services for quick addition to job tickets.">
                    <form onSubmit={handleAddCatalogItem} className="mt-2 flex gap-2 items-end">
                        <div className="flex-grow"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Item Name</label><input type="text" value={newCatalogItemName} onChange={(e) => setNewCatalogItemName(e.target.value)} placeholder="e.g. Torsion Spring" className={inputStyles} /></div>
                        <div className="w-32">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Default Cost</label>
                            <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 sm:text-sm">$</span></div><input type="number" value={newCatalogItemCost} onChange={(e) => setNewCatalogItemCost(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" className={`${inputStyles} pl-7`} /></div>
                        </div>
                        <button type="submit" className="mb-[2px] inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 transition-colors"><PlusIcon className="w-5 h-5" /></button>
                    </form>

                    <div className="mt-6 border-t dark:border-slate-700 pt-4">
                        {partsCatalog.length > 0 ? (
                            <ul className="space-y-2">
                                {partsCatalog.slice().sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                                    <li key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div><span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span><span className="ml-2 text-sm text-slate-500 dark:text-slate-400">${item.defaultCost.toFixed(2)}</span></div>
                                        <button onClick={() => handleDeleteCatalogItem(item.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">No items in catalog.</p>
                        )}
                    </div>
                </SettingsSection>
                
                <div className="mt-8 border-t dark:border-slate-700 pt-6">
                     <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Calendar Integration</h3>
                     <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Export your jobs to an external calendar.</p>
                      <div className="mt-6 space-y-3">
                         <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">Manual Export</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Download an .ics file to import into Google Calendar, Outlook, etc.</p>
                            </div>
                            <button onClick={handleExportCalendar} className="inline-flex items-center justify-center whitespace-nowrap flex-shrink-0 space-x-2 px-3 py-2 rounded-md text-sm font-medium text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"><CalendarIcon className="w-4 h-4" /><span>Export .ics</span></button>
                        </div>
                      </div>
                </div>

                <div className="mt-8 border-t dark:border-slate-700 pt-6 mb-8">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Backup & Restore</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your application data.</p>
                    <div className="mt-6 space-y-3">
                         <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">Manual Backup</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Download a JSON copy of all your data.</p>
                            </div>
                            <button onClick={handleManualBackup} className="inline-flex items-center justify-center whitespace-nowrap flex-shrink-0 space-x-2 px-3 py-2 rounded-md text-sm font-medium text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"><DownloadIcon className="w-4 h-4" /><span>Backup JSON</span></button>
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">Restore from Backup</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Import data from a backup file to overwrite current data.</p>
                            </div>
                            <label htmlFor="backup-upload" className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap flex-shrink-0 space-x-2 px-3 py-2 rounded-md text-sm font-medium text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"><UploadIcon className="w-4 h-4" /><span>Import Backup</span><input id="backup-upload" type="file" accept=".json" className="hidden" onChange={handleFileImport} /></label>
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Clear Bank Data</p>
                                <p className="text-xs text-red-600 dark:text-red-400">Delete all imported bank statements and transactions.</p>
                            </div>
                            <button 
                                onClick={() => setIsClearBankDataConfirmOpen(true)} 
                                className="inline-flex items-center justify-center whitespace-nowrap flex-shrink-0 space-x-2 px-3 py-2 rounded-md text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900 transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                <span>Clear Data</span>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
            {isTemplateModalOpen && (
                <JobTemplateModal
                    key={editingTemplate?.id || 'new'}
                    template={editingTemplate}
                    onSave={handleSaveTemplate}
                    onClose={() => { setIsTemplateModalOpen(false); setEditingTemplate(null); }}
                />
            )}
            {isRestoreConfirmOpen && (
                <ConfirmationModal
                    isOpen={isRestoreConfirmOpen}
                    onClose={() => {
                        setIsRestoreConfirmOpen(false);
                        setRestoreFileContent(null);
                    }}
                    onConfirm={handleConfirmRestore}
                    title="Restore Backup"
                    message="Restoring a backup will overwrite all current data. This action cannot be undone. Are you sure you want to proceed?"
                    confirmText="Restore"
                    confirmButtonClass="bg-sky-600 hover:bg-sky-700"
                />
            )}
            {isClearBankDataConfirmOpen && (
                <ConfirmationModal
                    isOpen={isClearBankDataConfirmOpen}
                    onClose={() => setIsClearBankDataConfirmOpen(false)}
                    onConfirm={() => {
                        handleDeleteAllBankData();
                        setIsClearBankDataConfirmOpen(false);
                        addNotification('All bank data has been cleared.', 'success');
                    }}
                    title="Clear All Bank Data"
                    message="Are you sure you want to delete ALL bank statements and transactions? This will also unreconcile any linked expenses. This action cannot be undone."
                    confirmText="Yes, Delete All"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                />
            )}
        </div>
    );
};

export default Settings;