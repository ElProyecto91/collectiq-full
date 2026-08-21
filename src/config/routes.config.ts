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
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];

export type NavItem = {
  /** Stable identifier used for active-state matching and analytics. */
  id: string;
  /** i18n key path used to resolve the label shown in the bottom navigation. */
  labelKey: string;
  /** Route path the item navigates to. */
  path: RoutePath;
  /** lucide-react icon component reference (resolved in the nav bar). */
  icon: 'Home' | 'LayoutGrid' | 'Compass' | 'Users' | 'User';
};
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
} as const;
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',       labelKey: 'nav.home',       path: RoutePaths.Home,       icon: 'Home' },
  { id: 'collection', labelKey: 'nav.collection',  path: RoutePaths.Collection, icon: 'LayoutGrid' },
  { id: 'explorer',   labelKey: 'nav.explorer',    path: RoutePaths.Explorer,   icon: 'Compass' },
  { id: 'community',  labelKey: 'nav.community',   path: RoutePaths.Community,  icon: 'Users' },
  { id: 'profile',    labelKey: 'nav.profile',     path: RoutePaths.Profile,    icon: 'User' },
] as const;