import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Brush,
  Hash,
  Layers,
  Scale,
  Shield,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';

import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useState } from 'react';
import { Check, Heart, Pencil } from 'lucide-react';

import { CardImage } from '../components';
import { AddToCollectionModal } from '@/features/collection/components';
import { useCollectionItem } from '@/features/collection/hooks';
import { useCatalogCard } from '../hooks';
import { useI18n } from '@/i18n';
import type { CatalogCard, CardLegalities } from '../types/catalog';

/**
 * Card Details — full card information surface.
 *
 * Reached by tapping a card in the Explorer. Displays the large card image and
 * every relevant attribute (name, HP, types, rarity, set, artist, number,
 * legalities, regulation mark). The "Add to My Collection" flow at the bottom
 * saves the card to the collector's Supabase-backed collection.
 */
export function CardDetailsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { data: card, isLoading, isError, error, refetch } = useCatalogCard(cardId);
  const { t } = useI18n();

  return (
    <div className="space-y-5 pt-3 animate-fade-in">
      <button
        onClick={() => navigate(RoutePaths.Explorer)}
        className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} /> {t.cardDetails.backToExplorer}
      </button>

      {isLoading ? (
        <CardDetailsSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-sm text-ink-soft">{t.cardDetails.couldNotLoad}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
            {t.cardDetails.tryAgain}
          </Button>
          {error && <p className="mt-2 text-xs text-ink-faint">{error.message}</p>}
        </div>
      ) : card ? (
        <CardDetailsContent card={card} />
      ) : null}
    </div>
  );
}

function CardDetailsContent({ card }: { card: CatalogCard }) {
  const { t, tr } = useI18n();

  return (
    <>
      {/* Large card image */}
      <CardImageBlock card={card} />

      {/* Title block */}
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{card.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">{card.set.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {card.supertype && <Badge variant="primary">{card.supertype}</Badge>}
          {card.subtypes.map((sub) => (
            <Badge key={sub}>{sub}</Badge>
          ))}
          {card.regulationMark && (
            <Badge variant="gold">{tr('cardDetails.reg', { mark: card.regulationMark })}</Badge>
          )}
        </div>
      </div>

      {/* Attribute grid */}
      <div className="grid grid-cols-2 gap-3">
        <AttributeTile icon={<Zap size={16} />} label={t.cardDetails.hp} value={card.hp ? String(card.hp) : '—'} />
        <AttributeTile
          icon={<Type size={16} />}
          label={t.cardDetails.types}
          value={card.types.length > 0 ? card.types.join(' · ') : '—'}
        />
        <AttributeTile
          icon={<Sparkles size={16} />}
          label={t.cardDetails.rarity}
          value={card.rarity ?? '—'}
          accent="gold"
        />
        <AttributeTile
          icon={<Layers size={16} />}
          label={t.cardDetails.set}
          value={card.set.name}
        />
        <AttributeTile
          icon={<Brush size={16} />}
          label={t.cardDetails.artist}
          value={card.artist ?? '—'}
        />
        <AttributeTile
          icon={<Hash size={16} />}
          label={t.cardDetails.number}
          value={`${card.number} / ${card.set.printedTotal ?? '?'}`}
        />
        {card.retreatCost !== null && (
          <AttributeTile
            icon={<Shield size={16} />}
            label={t.cardDetails.retreat}
            value={String(card.retreatCost)}
          />
        )}
        {card.evolvesFrom && (
          <AttributeTile
            icon={<Scale size={16} />}
            label={t.cardDetails.evolvesFrom}
            value={card.evolvesFrom}
          />
        )}
      </div>

      {/* Legalities */}
      {card.legalities && <LegalitiesBlock legalities={card.legalities} />}

      {/* Flavor text */}
      {card.flavorText && (
        <Card padding="md">
          <p className="text-sm italic leading-relaxed text-ink-soft">{card.flavorText}</p>
        </Card>
      )}

      {/* Add to collection CTA */}
      <AddToCollectionCta card={card} />
    </>
  );
}

function CardImageBlock({ card }: { card: CatalogCard }) {
  const src = card.images.large ?? card.images.small;

  return (
    <div className="mx-auto flex max-w-[280px]">
      <CardImage
        src={src}
        alt={card.name}
        className="aspect-[3/4] w-full rounded-2xl border border-line"
        fallbackIconSize={32}
        lazy={false}
      />
    </div>
  );
}

function AttributeTile({
  icon,
  label,
  value,
  accent = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'default' | 'gold' | 'primary';
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-ink-muted">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={cx(
          'truncate text-sm font-semibold',
          accent === 'gold' && 'text-accent',
          accent === 'primary' && 'text-primary-soft',
          accent === 'default' && 'text-ink'
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function LegalitiesBlock({ legalities }: { legalities: CardLegalities }) {
  const { t } = useI18n();
  const entries = Object.entries(legalities) as Array<[keyof CardLegalities, string]>;
  if (entries.length === 0) return null;

  return (
    <Card padding="md">
      <div className="mb-3 flex items-center gap-2">
        <Scale size={16} className="text-primary-soft" />
        <h3 className="text-sm font-semibold text-ink">{t.cardDetails.legalities}</h3>
      </div>
      <div className="space-y-2">
        {entries.map(([format, status]) => {
          const translated = status === 'Legal' ? t.cardDetails.legal : status === 'Banned' ? t.cardDetails.banned : t.cardDetails.restricted;
          return (
            <div key={format} className="flex items-center justify-between">
              <span className="text-sm capitalize text-ink-soft">{format}</span>
              <Badge variant={status === 'Legal' ? 'success' : status === 'Banned' ? 'error' : 'warning'}>
                {translated}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AddToCollectionCta({ card }: { card: CatalogCard }) {
  const { t, tr } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: existing, isLoading } = useCollectionItem(card.id);

  if (existing) {
    return (
      <>
        <div className="space-y-2">
          <Card padding="md" className="flex items-center gap-3 border-success/30 bg-success/5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{t.cardDetails.inYourCollection}</p>
              <p className="text-xs text-ink-soft">{tr('cardDetails.quantity', { qty: existing.quantity })}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Pencil size={15} />}
              onClick={() => setModalOpen(true)}
            >
              {t.cardDetails.edit}
            </Button>
          </Card>
        </div>
        <AddToCollectionModal
          card={card}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          existing={existing}
        />
      </>
    );
  }

  return (
    <>
      <div className="pb-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={<Heart size={20} />}
          onClick={() => setModalOpen(true)}
          disabled={isLoading}
        >
          {t.cardDetails.addToCollection}
        </Button>
      </div>
      <AddToCollectionModal
        card={card}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function CardDetailsSkeleton() {
  return (
    <>
      <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[280px] rounded-2xl" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
    </>
  );
}
