/**
 * Pokémon catalog feature barrel.
 *
 * Re-exports the feature's public surface (pages, hooks, services, types) so
 * the rest of the app imports from a single entry point. Future TCG catalog
 * features (One Piece, Yu-Gi-Oh!) get their own sibling module under
 * `features/<tcg>-catalog/` with the same internal structure.
 */
export * from './pages';
export * from './hooks';
export * from './services';
export * from './types';
export * from './components';
