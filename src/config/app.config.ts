/**
 * Central application configuration.
 * All static, environment-driven, and feature-flag values live here so that
 * no magic strings or ad-hoc env reads are scattered across the codebase.
 */

const env = import.meta.env;

const stringEnv = (value: string | undefined, fallback = ''): string =>
  value && value.length > 0 ? value : fallback;

const booleanEnv = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

export const AppConfig = {
  name: 'CollectIQ',
  tagline: 'The premium collectors companion',

  /** Supabase project connection (pre-populated in .env). */
  supabase: {
    url: stringEnv(env.VITE_SUPABASE_URL),
    anonKey: stringEnv(env.VITE_SUPABASE_ANON_KEY),
  },

  /** Telegram Mini App config. */
  telegram: {
    /** Whether the app expects to run inside the Telegram WebView. */
    enabled: true,
    /** Mount point for the external SDK script (loaded in index.html). */
    scriptUrl: 'https://telegram.org/js/telegram-web-app.js',
  },

  /** Feature flags — extension points reserved for future modules. */
  features: {
    scanner: booleanEnv(env.VITE_FEATURE_SCANNER, false),
    catalog: booleanEnv(env.VITE_FEATURE_CATALOG, false),
    trading: booleanEnv(env.VITE_FEATURE_TRADING, false),
    communities: booleanEnv(env.VITE_FEATURE_COMMUNITIES, false),
    achievements: booleanEnv(env.VITE_FEATURE_ACHIEVEMENTS, false),
    notifications: booleanEnv(env.VITE_FEATURE_NOTIFICATIONS, false),
    i18n: booleanEnv(env.VITE_FEATURE_I18N, false),
  },

  /** The list of TCG verticals CollectIQ is prepared to support. */
  tcgs: ['pokemon', 'one-piece', 'yugioh', 'lorcana', 'magic'] as const,

  /** UI defaults. */
  ui: {
    defaultTcg: 'pokemon' as const,
    itemsPerPage: 24,
  },
} as const;

export type AppConfigType = typeof AppConfig;
