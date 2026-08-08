import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  I18nContext,
  type I18nContextValue,
  type Locale,
  type Translation,
  STORAGE_KEY,
  defaultLocale,
  interpolate,
  resolveKey,
  translations,
} from './i18n-context';

const isLocale = (value: string | null): value is Locale =>
  value === 'es' || value === 'en';

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode, SSR) — fall through.
  }
  return defaultLocale;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  // Persist locale changes to localStorage.
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors — in-memory state is the source of truth for this session.
    }
  }, []);

  // Sync across tabs / windows.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isLocale(e.newValue)) {
        setLocaleState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = translations[locale];
    // `t` is the full nested object; callers use it directly for typed access.
    // The `tr` helper resolves dot-paths with interpolation for dynamic strings.
    return {
      locale,
      setLocale,
      t,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
