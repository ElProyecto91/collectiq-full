import { useI18nContext, interpolate, resolveKey, type Locale, type Translation } from './i18n-context';

export type { Locale, Translation };

/**
 * Primary i18n hook.
 *
 * Returns the current locale, a setter, and `t` (the full typed translation
 * object for direct property access, e.g. `t.home.scanCard`). For dynamic
 * keys or interpolated strings, use the `tr()` helper returned alongside.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n();
 *   <h1>{t.home.scanCard}</h1>
 *   {t.collection.noMatchesDesc}  // direct
 *
 *   const { tr } = useI18n();
 *   tr('collection.noMatchesDesc', { search: 'Pikachu' })
 */
export function useI18n() {
  const { locale, setLocale, t } = useI18nContext();

  const tr = (key: string, params?: Record<string, string | number>): string => {
    const template = resolveKey(t, key);
    return interpolate(template, params);
  };

  return { locale, setLocale, t, tr };
}
