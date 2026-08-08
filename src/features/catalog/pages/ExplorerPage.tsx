import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Loader2, SearchX } from 'lucide-react';

import { Badge, Button, EmptyState, ErrorState, SearchInput } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useInfiniteScroll } from '@/hooks';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useI18n } from '@/i18n';

import { useCatalogSearch } from '../hooks';
import { CatalogCardItem } from '../components';
import type { CatalogCard } from '../types/catalog';

/**
 * Explorer — the Pokémon catalog browser.
 *
 * A functional search bar queries the Pokémon TCG API by card name, card
 * number, and set name. Results render as premium card tiles in a responsive
 * grid with infinite scrolling. Loading skeletons, error states, and an empty
 * search state are all handled. Tapping a card opens the Card Details page.
 */
export function ExplorerPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { t, tr } = useI18n();

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCatalogSearch(query);

  const sentinelRef = useInfiniteScroll(
    () => void fetchNextPage(),
    Boolean(hasNextPage && !isFetchingNextPage)
  );

  const cards = useMemo<CatalogCard[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.cards);
  }, [data]);

  const totalCount = data?.pages?.[0]?.totalCount ?? 0;
  const hasQuery = query.trim().length > 0;
  const hasResults = cards.length > 0;

  const openCard = (card: CatalogCard) => {
    navigate(`${RoutePaths.Explorer}/card/${card.id}`);
  };

  return (
    <div className="space-y-4 pt-3 animate-fade-in">
      <PageHeader
        title={t.explorer.title}
        subtitle={t.explorer.subtitle}
      />

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t.explorer.searchPlaceholder}
        ariaLabel={t.explorer.searchAria}
      />

      {hasResults && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            {hasQuery ? tr('explorer.resultsFor', { query: query.trim() }) : t.explorer.latestCards}
            {totalCount > 0 && ` · ${tr('explorer.matches', { count: totalCount.toLocaleString() })}`}
          </span>
        </div>
      )}

      {isLoading ? (
        <ExplorerGridSkeleton />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title={t.explorer.searchFailed} />
      ) : !hasResults ? (
        hasQuery ? (
          <EmptyState
            icon={<SearchX size={28} strokeWidth={1.8} />}
            title={t.explorer.noCardsFound}
            description={tr('explorer.noCardsFoundDesc', { query: query.trim() })}
          />
        ) : (
          <EmptyState
            icon={<Compass size={28} strokeWidth={1.8} />}
            title={t.explorer.startSearching}
            description={t.explorer.startSearchingDesc}
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <CatalogCardItem key={card.id} card={card} onOpen={openCard} />
            ))}
          </div>

          <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
          {isFetchingNextPage && <LoadingMoreRow />}
          {hasNextPage && !isFetchingNextPage && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => void fetchNextPage()}
              leftIcon={<Loader2 size={15} className="animate-spin" />}
              className={cx('text-ink-soft')}
            >
              {t.explorer.loadMore}
            </Button>
          )}
          {!hasNextPage && hasResults && (
            <p className="pb-2 text-center text-xs text-ink-faint">{t.explorer.endOfResults}</p>
          )}
        </>
      )}
    </div>
  );
}

function ExplorerGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line-soft bg-surface-2 p-3">
          <div className="mb-3 aspect-[3/4] w-full animate-shimmer rounded-xl" />
          <div className="mb-2 h-3.5 w-3/4 animate-shimmer rounded" />
          <div className="h-3 w-1/2 animate-shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

function LoadingMoreRow() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-sm text-ink-muted">
      <Loader2 size={16} className="animate-spin" />
      {t.explorer.loadingMore}
    </div>
  );
}
