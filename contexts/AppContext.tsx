import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { FirebaseUser as User, db } from '../firebase.ts';
import { doc, onSnapshot, setDoc, collection, writeBatch, getDocs } from 'firebase/firestore';
import { DefaultFieldSetting, BusinessInfo, JobTemplate, JobStatus, ALL_JOB_STATUSES, EmailSettings, DEFAULT_EMAIL_SETTINGS, CatalogItem, MapSettings, Theme, SavedRouteStop, CategorizationRule } from '../types.ts';
import * as idb from '../db.ts';

export interface AppContextType {
    // State
    user: User | null;
    isGuestMode: boolean;
    theme: Theme;
    isGlobalLoading: boolean;
    globalLoadingMessage: string | null;
    
    // Settings state
    defaultFields: DefaultFieldSetting[];
    businessInfo: BusinessInfo;
    emailSettings: EmailSettings;
    jobTemplates: JobTemplate[];
    partsCatalog: CatalogItem[];
    enabledStatuses: Record<JobStatus, boolean>;
    mapSettings: MapSettings;
    showContactPhotos: boolean;
    routes: Record<string, SavedRouteStop[]>;
    categorizationRules: CategorizationRule[];
    settings: any;

    // Actions
    onSwitchToCloud: () => void;
    saveSettings: (updates: any) => Promise<void>;
    handleSaveCategorizationRules: (rules: CategorizationRule[]) => Promise<void>;
    setTheme: (theme: Theme) => void;
    setIsGlobalLoading: (isLoading: boolean) => void;
    setGlobalLoadingMessage: (message: string | null) => void;
    handleSaveRoute: (date: string, route: SavedRouteStop[]) => void;
    handleClearRouteForDate: (date: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
};

interface AppProviderProps {
    user: User | null;
    isGuestMode: boolean;
    onSwitchToCloud: () => void;
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ user, isGuestMode, onSwitchToCloud, children }) => {
    const [settings, setSettings] = useState<any>({});
    const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([]);
    const getInitialTheme = (): Theme => (localStorage.getItem('theme') as Theme | null) || 'system';
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);
    const [globalLoadingMessage, setGlobalLoadingMessage] = useState<string | null>(null);

    const setTheme = (newTheme: Theme) => { setThemeState(newTheme); localStorage.setItem('theme', newTheme); };

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (localStorage.getItem('theme') === 'system') root.classList.toggle('dark', e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (isGuestMode) {
                const sSettings = await idb.getSettings();
                const sRules = await idb.getCategorizationRules();
                setSettings(sSettings || {});
                setCategorizationRules(sRules || []);
            } else {
                setSettings({});
                setCategorizationRules([]);
            }
        };
        loadInitialData();
    }, [isGuestMode]);
    
    useEffect(() => {
        if (isGuestMode || !user || !db) return;
        const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'settings', 'general'), (docSnap) => setSettings(docSnap.exists() ? docSnap.data() : {}));
        const unsubRules = onSnapshot(collection(db, 'users', user.uid, 'categorizationRules'), (snap) => setCategorizationRules(snap.docs.map(d => d.data() as CategorizationRule)));
        return () => { unsubSettings(); unsubRules(); };
    }, [user, isGuestMode]);

    const saveSettings = async (updates: any) => {
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);
        if (isGuestMode) {
            await idb.saveSettings(newSettings);
            return;
        }
        if (!user || !db) return;
        try {
            await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), updates, { merge: true });
        } catch (error) { console.error("Error saving settings:", error); }
    };
    
    const handleSaveCategorizationRules = async (rules: CategorizationRule[]) => {
        setCategorizationRules(rules);
        if (isGuestMode) {
            await idb.clearStore(idb.CATEGORIZATION_RULES_STORE);
            await idb.putItems(idb.CATEGORIZATION_RULES_STORE, rules);
        } else if (user && db) {
            const batch = writeBatch(db);
            const existingRulesSnapshot = await getDocs(collection(db, 'users', user.uid, 'categorizationRules'));
            const existingRulesIds = new Set(existingRulesSnapshot.docs.map(d => d.id));
            const newRuleIds = new Set(rules.map(r => r.id));
            
            // FIX: Explicitly type `oldId` as a string to resolve a TypeScript inference issue where it was being treated as 'unknown'.
            existingRulesIds.forEach((oldId: string) => {
                if (!newRuleIds.has(oldId)) {
                    batch.delete(doc(db, 'users', user.uid, 'categorizationRules', oldId));
                }
            });

            rules.forEach(rule => {
                batch.set(doc(db, 'users', user.uid, 'categorizationRules', rule.id), rule);
            });
            await batch.commit();
        }
    };
    
    const handleSaveRoute = (date: string, route: SavedRouteStop[]) => {
        const newRoutes = { ...(settings.routes || {}), [date]: route };
        saveSettings({ routes: newRoutes });
    };

    const handleClearRouteForDate = (date: string) => {
        const newRoutes = { ...(settings.routes || {}) };
        if (newRoutes[date]) {
            delete newRoutes[date];
            saveSettings({ routes: newRoutes });
        }
    };

    // Memoized derived state from settings
    const defaultFields = useMemo(() => settings.defaultFields || [], [settings.defaultFields]);
    const businessInfo = useMemo(() => settings.businessInfo || { name: '', address: '', phone: '', email: '', logoUrl: '' }, [settings.businessInfo]);
    const emailSettings = useMemo(() => settings.emailSettings || DEFAULT_EMAIL_SETTINGS, [settings.emailSettings]);
    const jobTemplates = useMemo(() => settings.jobTemplates || [], [settings.jobTemplates]);
    const partsCatalog = useMemo(() => settings.partsCatalog || [], [settings.partsCatalog]);
    const enabledStatuses = useMemo(() => {
        const defaults = {} as Record<JobStatus, boolean>;
        ALL_JOB_STATUSES.forEach(s => defaults[s] = true);
        return { ...defaults, ...(settings.enabledStatuses || {}) };
    }, [settings.enabledStatuses]);
    const showContactPhotos = useMemo(() => settings.showContactPhotos !== false, [settings.showContactPhotos]);
    const mapSettings = useMemo(() => ({
        apiKey: settings.mapSettings?.apiKey || ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '',
        homeAddress: settings.mapSettings?.homeAddress || ''
    }), [settings.mapSettings]);
    const routes = useMemo(() => settings.routes || {}, [settings.routes]);

    const value: AppContextType = {
        user, isGuestMode, onSwitchToCloud,
        defaultFields, businessInfo, emailSettings, jobTemplates, partsCatalog, enabledStatuses, mapSettings, showContactPhotos, routes, categorizationRules,
        theme, isGlobalLoading, globalLoadingMessage,
        settings,
        saveSettings, handleSaveCategorizationRules, setTheme, setIsGlobalLoading, setGlobalLoadingMessage, handleSaveRoute, handleClearRouteForDate
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};