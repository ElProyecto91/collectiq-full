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
import ScannerPage from '@/features/scanner/ScannerPage';
import { CardDetailsPage } from '@/features/catalog/pages/CardDetailsPage';

/**
 * App router.
 *
 * Primary tabs render inside the AppLayout shell (with bottom navigation).
 * The scanner renders standalone (no bottom nav) for a focused full-screen
 * capture experience. Card details render inside the shell so the bottom nav
 * stays available. Routes are declared here so the navigation graph stays in
 * one place; future features add a route here and a page module.
 */
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
    ],
  },
  {
    path: RoutePaths.Scanner,
    element: <ScannerPage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
