"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../lib/i18n';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [lang, setLangState] = useState<Language>('en');

    useEffect(() => {
        // BUG FIX #7: Removed unnecessary setTimeout wrapper.
        // useEffect only runs on the client, so setting state directly here is safe.
        // The previous pattern caused Tamil users to see an English flash on every page load
        // because the component rendered with 'en' first, then switched after the timeout.
        const saved = localStorage.getItem('lang') as Language;
        if (saved) {
            setLangState(saved);
        }
    }, []);

    const setLang = (newLang: Language) => {
        setLangState(newLang);
        localStorage.setItem('lang', newLang);
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within LanguageProvider');
    return context;
};
