import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AppLayout } from '@/layouts';
import { RoutePaths } from '@/config';
import {
  CollectionPage,
  ExplorerPage,
  HomePage,
  ProfilePage,
  WishlistPage,
} from '@/pages';
import { LoginPage } from '@/pages/LoginPage';
import ScannerPage from '@/features/scanner/ScannerPage';
import { CardDetailsPage } from '@/features/catalog/pages/CardDetailsPage';
import { CommunityPage } from '@/pages/CommunityPage';
import { DecksPage } from '@/pages/DecksPage';
import { DeckDetailPage } from '@/pages/DeckDetailPage';

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
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}