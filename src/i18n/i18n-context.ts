import { createContext, useContext } from 'react';

import { es } from './locales/es';
import type { en } from './locales/en';

export type Locale = 'es' | 'en';

export type Translation = typeof es;

export const translations: Record<Locale, Translation> = {
  es,
  // Lazy type — `en` is structurally validated via `typeof es`.
  en: 0 as unknown as Translation,
};

// Load `en` at module level so translations object is complete.
import { en as enLocale } from './locales/en';
translations.en = enLocale;

export const defaultLocale: Locale = 'es';

export const STORAGE_KEY = 'collectiq.locale';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translation;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

/** Recursively resolve a dot-path key against the translation object. */
export function resolveKey(obj: unknown, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path; // fallback to key itself
    }
  }
  return typeof current === 'string' ? current : path;
}

/** Replace {placeholder} tokens in a string with provided values. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`
  );
}
