import { Heart } from 'lucide-react';

import { EmptyState, SearchInput } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useI18n } from '@/i18n';
import { useState } from 'react';

/**
 * Wishlist — cards the collector wants.
 *
 * Architecture-ready: the wishlist service and hooks are wired; this page
 * shows the search surface and empty state until cards can be added via the
 * Explorer/catalog. Future trading features will read from the same data.
 */
export function WishlistPage() {
  const [search, setSearch] = useState('');
  const { t } = useI18n();

  return (
    <div className="space-y-4 pt-3 animate-fade-in">
      <PageHeader title={t.wishlist.title} subtitle={t.wishlist.subtitle} />

      <SearchInput value={search} onChange={setSearch} placeholder={t.wishlist.searchPlaceholder} />

      <EmptyState
        icon={<Heart size={28} strokeWidth={1.8} />}
        title={t.wishlist.empty}
        description={t.wishlist.emptyDesc}
      />
    </div>
  );
}
