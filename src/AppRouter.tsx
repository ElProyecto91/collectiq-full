import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts';
import { RoutePaths } from '@/config';
import {
  CollectionPage, ExplorerPage, HomePage, ProfilePage,
  WishlistPage, CommunityPage, DecksPage, DeckDetailPage,
  StatsPage, AchievementsPage, MissionsPage, FriendsPage,
  PremiumPage, NotificationsPage,
} from '@/pages';
import { LoginPage } from '@/pages/LoginPage';
import ScannerPage from '@/features/scanner/ScannerPage';
import { CardDetailsPage } from '@/features/catalog/pages/CardDetailsPage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { CreateDeckPage } from '@/pages/CreateDeckPage';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: RoutePaths.Home, element: <HomePage /> },
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
    ],
  },
  { path: RoutePaths.Scanner, element: <ScannerPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/u/:telegramId', element: <PublicProfilePage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}