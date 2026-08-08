export { HomePage } from './HomePage';
export { CollectionPage } from '@/features/collection/pages/CollectionPage';
export { WishlistPage } from './WishlistPage';
export { ProfilePage } from './ProfilePage';
// Explorer now lives in the catalog feature module and is re-exported here
// so the router's import surface stays unchanged.
export { ExplorerPage } from '@/features/catalog/pages/ExplorerPage';
