import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DICTIONARY, type TranslationDictionary } from './dictionary';
import type { Language } from './types';

const STORAGE_KEY = 'seismap:lang';

function normalizeLanguage(value: string | null): Language {
  return value === 'en' ? 'en' : 'id';
}

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'id';
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'id';
  }
}

let activeLanguage: Language = readStoredLanguage();

export function getActiveLanguage(): Language {
  return activeLanguage;
}

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  t: TranslationDictionary;
  tx: <T = string>(idText: T, enText: T) => T;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readStoredLanguage());

  useEffect(() => {
    activeLanguage = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Abaikan jika penyimpanan lokal dinonaktifkan oleh browser.
      }
    }
  }, [lang]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const next = normalizeLanguage(event.newValue);
        activeLanguage = next;
        setLangState(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLang = useCallback((next: Language) => {
    activeLanguage = next;
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'id' ? 'en' : 'id';
      activeLanguage = next;
      return next;
    });
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang,
    toggleLang,
    t: DICTIONARY[lang],
    tx: <T = string>(idText: T, enText: T) => (lang === 'en' ? enText : idText),
  }), [lang, setLang, toggleLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error('useI18n harus digunakan di dalam LanguageProvider.');
  }
  return value;
}
