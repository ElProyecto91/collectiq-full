import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts';
import { RoutePaths } from '@/config';
import {
  CollectionPage, ExplorerPage, HomePage, ProfilePage,
  WishlistPage, CommunityPage, DecksPage, DeckDetailPage,
  StatsPage, AchievementsPage, MissionsPage, FriendsPage,
  PremiumPage, NotificationsPage, AdminPage, CollectablesHub,
} from '@/pages';
import { LoginPage } from '@/pages/LoginPage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { CreateDeckPage } from '@/pages/CreateDeckPage';
import { MarketplacePage } from '@/pages/MarketplacePage';
import ScannerPage from '@/features/scanner/ScannerPage';
import { CardDetailsPage } from '@/features/catalog/pages/CardDetailsPage';
import { FunkoHomePage } from '@/features/funko/pages/FunkoHomePage';
import { FunkoScannerPage } from '@/features/funko/pages/FunkoScannerPage';
import { FunkoExplorerPage } from '@/features/funko/pages/FunkoExplorerPage';
import { FunkoWishlistPage } from '@/features/funko/pages/FunkoWishlistPage';
import { FunkoDetailPage } from '@/features/funko/pages/FunkoDetailPage';
import { FunkoStatsPage } from '@/features/funko/pages/FunkoStatsPage';
import { FunkoChecklistPage } from '@/features/funko/pages/FunkoChecklistPage';
import { FunkoEditItemPage } from '@/features/funko/pages/FunkoEditItemPage';
import { FunkoFoldersPage } from '@/features/funko/pages/FunkoFoldersPage';
import { PokemonHomePage } from '@/features/pokemon/pages/PokemonHomePage';
import { PokedexPage } from '@/features/pokemon/pages/PokedexPage';
import { PokedexDetailPage } from '@/features/pokemon/pages/PokedexDetailPage';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: RoutePaths.Home, element: <HomePage /> },
      { path: RoutePaths.Hub, element: <CollectablesHub /> },
      { path: RoutePaths.Collection, element: <CollectionPage /> },
      { path: RoutePaths.Explorer, element: <ExplorerPage /> },
      { path: RoutePaths.CardDetails, element: <CardDetailsPage /> },
      { path: RoutePaths.Wishlist, element: <WishlistPage /> },
      { path: RoutePaths.Profile, element: <ProfilePage /> },
      { path: RoutePaths.Community, element: <CommunityPage /> },
      { path: RoutePaths.Decks, element: <DecksPage /> },
      { path: RoutePaths.DeckDetail, element: <DeckDetailPage /> },
      { path: '/decks/new', element: <CreateDeckPage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '/achievements', element: <AchievementsPage /> },
      { path: '/missions', element: <MissionsPage /> },
      { path: '/friends', element: <FriendsPage /> },
      { path: '/premium', element: <PremiumPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: RoutePaths.Marketplace, element: <MarketplacePage /> },
      // Pokémon
      { path: RoutePaths.PokemonHome, element: <PokemonHomePage /> },
      { path: RoutePaths.Pokedex, element: <PokedexPage /> },
      { path: RoutePaths.PokedexDetail, element: <PokedexDetailPage /> },
      // Funko
      { path: RoutePaths.FunkoHome, element: <FunkoHomePage /> },
      { path: RoutePaths.FunkoExplorer, element: <FunkoExplorerPage /> },
      { path: RoutePaths.FunkoWishlist, element: <FunkoWishlistPage /> },
      { path: RoutePaths.FunkoStats, element: <FunkoStatsPage /> },
      { path: RoutePaths.FunkoChecklist, element: <FunkoChecklistPage /> },
      { path: RoutePaths.FunkoFolders, element: <FunkoFoldersPage /> },
      { path: RoutePaths.FunkoEditItem, element: <FunkoEditItemPage /> },
      { path: RoutePaths.FunkoDetail, element: <FunkoDetailPage /> },
    ],
  },
  { path: RoutePaths.Scanner, element: <ScannerPage /> },
  { path: RoutePaths.FunkoScanner, element: <FunkoScannerPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/u/:telegramId', element: <PublicProfilePage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}