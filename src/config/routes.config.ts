export const RoutePaths = {
  Home: '/',
  Collection: '/collection',
  Explorer: '/explorer',
  CardDetails: '/explorer/card/:cardId',
  Wishlist: '/wishlist',
  Profile: '/profile',
  Scanner: '/scanner',
  Community: '/community',
  Marketplace: '/market',
  // Pokémon
  PokemonHome: '/pokemon',
  Pokedex: '/pokedex',
  PokedexDetail: '/pokedex/:id',
  // Funko
  FunkoHome: '/funko',
  FunkoScanner: '/funko/scanner',
  FunkoExplorer: '/funko/explorer',
  FunkoWishlist: '/funko/wishlist',
  FunkoStats: '/funko/stats',
  FunkoChecklist: '/funko/checklist',
  FunkoFolders: '/funko/folders',
  FunkoEditItem: '/funko/edit/:id',
  FunkoDetail: '/funko/:id',
  // One Piece
  OnePieceHome: '/onepiece',
  OnePieceExplorer: '/onepiece/explorer',
  // Magic (backend listo, frontend pendiente)
  MagicHome: '/magic',
  MagicExplorer: '/magic/explorer',
  // Yu-Gi-Oh (backend listo, frontend pendiente)
  YugiohHome: '/yugioh',
  YugiohExplorer: '/yugioh/explorer',
  // Lorcana (backend listo, frontend pendiente)
  LorcanaHome: '/lorcana',
  LorcanaExplorer: '/lorcana/explorer',
  // Digimon (pendiente)
  DigimonHome: '/digimon',
  // Dragon Ball (pendiente)
  DragonBallHome: '/dragonball',
  // Star Wars (pendiente)
  StarWarsHome: '/starwars',
  // Reportes de usuarios
  BugReport: '/report',
  // Admin
  Admin: '/admin',
  // Notificaciones
  Notifications: '/notifications',
  // Premium
  Premium: '/premium',
  // Stats
  Stats: '/stats',
  // Achievements
  Achievements: '/achievements',
  // Missions
  Missions: '/missions',
  // Friends
  Friends: '/friends',
  // Decks
  Decks: '/decks',
  DeckDetail: '/decks/:deckId',
  // Hub
  Hub: '/hub',
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];

export type NavItem = {
  id: string;
  labelKey: string;
  path: RoutePath;
  icon: 'Home' | 'LayoutGrid' | 'Compass' | 'ShoppingBag' | 'Users' | 'User';
};

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',        labelKey: 'nav.home',        path: RoutePaths.Home,        icon: 'Home' },
  { id: 'collection',  labelKey: 'nav.collection',  path: RoutePaths.Collection,  icon: 'LayoutGrid' },
  { id: 'marketplace', labelKey: 'nav.marketplace', path: RoutePaths.Marketplace, icon: 'ShoppingBag' },
  { id: 'community',   labelKey: 'nav.community',   path: RoutePaths.Community,   icon: 'Users' },
  { id: 'profile',     labelKey: 'nav.profile',     path: RoutePaths.Profile,     icon: 'User' },
] as const;

// ROOT_PATHS para AppLayout (ocultar back button en Telegram)
export const ROOT_PATHS = [
  RoutePaths.Home,
  RoutePaths.Collection,
  RoutePaths.Marketplace,
  RoutePaths.Community,
  RoutePaths.Profile,
];
