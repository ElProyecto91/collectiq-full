import { useCallback } from 'react';
import { useI18n } from '@/i18n';
import { colorName } from './color-names';

/** `cn(name)` -> the color name in the app's language. */
export function useColorName(): (name: string | null | undefined) => string {
  const { locale } = useI18n();
  return useCallback((name) => colorName(name, locale), [locale]);
}
