import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AppLayout } from '@/layouts';
import { RoutePaths } from '@/config';
import {
  CollectionPage,
  ExplorerPage,
  HomePage,
  ProfilePage,
  WishlistPage,
  CommunityPage,
  DecksPage,
  DeckDetailPage,
} from '@/pages';
import { LoginPage } from '@/pages/LoginPage';
import ScannerPage from '@/features/scanner/ScannerPage';
import { CardDetailsPage } from '@/features/catalog/pages/CardDetailsPage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { OnboardingPage } from '@/pages/OnboardingPage';

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
    ],
  },
  {
    path: RoutePaths.Scanner,
    element: <ScannerPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    path: '/u/:telegramId',
    element: <PublicProfilePage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}