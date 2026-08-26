// src/hooks/index.ts

// ── Hooks existentes (no tocar) ──────────────────────────────────────────────
export { useTelegram, useDisplayName } from './use-telegram';
export * from './use-profile';
export * from './use-analytics';
export * from './use-premium';
export * from './use-missions';
export * from './use-xp';
export * from './use-streak';
export * from './use-follows';
export * from './use-feature-votes';
export * from './use-currency';
export * from './use-infinite-scroll';
export * from './use-active-tcg';

// ── Hooks nuevos universales ─────────────────────────────────────────────────
export * from './use-collection';
export * from './use-wishlist';
export * from './use-tcg-registry';
export * from './use-scanner';