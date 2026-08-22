/**
 * Route path constants.
 * Centralizing paths prevents string drift when navigation changes and gives
 * type-safe imports for every link, redirect, and active-state check.
 */
export const RoutePaths = {
  Home: '/',
  Collection: '/collection',
  Explorer: '/explorer',
  CardDetails: '/explorer/card/:cardId',
  Wishlist: '/wishlist',
  Profile: '/profile',
  Scanner: '/scanner',
  Community: '/community',
  Decks: '/decks',
  DeckDetail: '/decks/:deckId',
  // Hub multi-coleccionable
  Hub: '/hub',
  // Funko
  FunkoHome: '/funko',
  FunkoScanner: '/funko/scanner',
  FunkoExplorer: '/funko/explorer',
  FunkoWishlist: '/funko/wishlist',
  FunkoDetail: '/funko/:id',
  FunkoStats: '/funko/stats',
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];

export type NavItem = {
  id: string;
  labelKey: string;
  path: RoutePath;
  icon: 'Home' | 'LayoutGrid' | 'Compass' | 'Users' | 'User';
};

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',       labelKey: 'nav.home',       path: RoutePaths.Home,       icon: 'Home' },
  { id: 'collection', labelKey: 'nav.collection',  path: RoutePaths.Collection, icon: 'LayoutGrid' },
  { id: 'explorer',   labelKey: 'nav.explorer',    path: RoutePaths.Explorer,   icon: 'Compass' },
  { id: 'community',  labelKey: 'nav.community',   path: RoutePaths.Community,  icon: 'Users' },
  { id: 'profile',    labelKey: 'nav.profile',     path: RoutePaths.Profile,    icon: 'User' },
] as const;