import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, Star, X, Heart, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { cx } from '@/utils';
import { useUserStore } from '@/store';
import { useI18n } from '@/i18n';

import {
  collectionService,
  DEFAULT_FORM_VALUES,
  type CollectionFormValues,
} from '../services';
import {
  useCreateCollectionItem,
  useUpdateCollectionItem,
  useCollectionItem,
} from '../hooks';
import {
  CONDITIONS,
  LANGUAGES,
  FINISHES,
  ACQUISITION_METHODS,
} from '../types';
import type { CatalogCard } from '@/features/catalog/types/catalog';
import type { UserCard } from '../types';

/**
 * AddToCollectionModal — premium modal for adding/editing a card in the collection.
 *
 * Opens from the Card Details page. Lets the collector set quantity, condition,
 * language, finish, edition, purchase price, acquisition method, acquisition
 * date, notes, favorite, and showcase. The showcase flag is mutually exclusive
 * per user — the service clears any previous showcase before setting a new one.
 *
 * When editing an existing card, the form pre-fills from the stored values.
 */

interface AddToCollectionModalProps {
  card: CatalogCard;
  open: boolean;
  onClose: () => void;
  /** Existing entry to edit. When provided, the modal operates in edit mode. */
  existing?: UserCard | null;
}

export function AddToCollectionModal({ card, open, onClose, existing }: AddToCollectionModalProps) {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const createMutation = useCreateCollectionItem();
  const updateMutation = useUpdateCollectionItem();

  const [form, setForm] = useState<CollectionFormValues>(DEFAULT_FORM_VALUES);
  const isEditing = Boolean(existing);
  const { t } = useI18n();

  // Pre-fill form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        quantity: existing.quantity,
        condition: existing.condition,
        language: existing.language,
        edition: existing.edition ?? '',
        finish: existing.finish,
        purchasePrice: existing.purchasePrice !== null ? String(existing.purchasePrice) : '',
        acquisitionMethod: existing.acquisitionMethod,
        acquisitionDate: existing.acquisitionDate ?? '',
        notes: existing.notes ?? '',
        favorite: existing.favorite,
        showcase: existing.showcase,
      });
    } else {
      setForm(DEFAULT_FORM_VALUES);
    }
  }, [existing, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const update = <K extends keyof CollectionFormValues>(key: K, value: CollectionFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!telegramUser?.id) return;

    if (isEditing && existing) {
      updateMutation.mutate(
        {
          id: existing.id,
          update: {
            quantity: form.quantity,
            condition: (form.condition as never) ?? null,
            language: (form.language as never) ?? null,
            edition: form.edition || null,
            finish: (form.finish as never) ?? null,
            purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
            acquisitionMethod: (form.acquisitionMethod as never) ?? null,
            acquisitionDate: form.acquisitionDate || null,
            notes: form.notes || null,
            favorite: form.favorite,
            showcase: form.showcase,
          },
        },
        { onSuccess: onClose }
      );
    } else {
      const input = collectionService.buildInput(telegramUser.id, card, form);
      createMutation.mutate(input, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal sheet */}
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-line-soft bg-surface-1 shadow-2xl animate-scale-in sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? t.modal.editCollectionCard : t.modal.addToCollection}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-surface-3">
              {card.images.small ? (
                <img
                  src={card.images.small}
                  alt={card.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Sparkles size={20} className="text-ink-faint" />
              )}
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                {isEditing ? t.modal.editCardTitle : t.modal.addToCollectionTitle}
              </h2>
              <p className="truncate text-xs text-ink-soft">{card.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-ink-soft transition-colors hover:text-ink"
            aria-label={t.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-2">
          {/* Quantity */}
          <FieldGroup label={t.modal.quantity}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update('quantity', Math.max(1, form.quantity - 1))}
                disabled={form.quantity <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-[3ch] text-center font-display text-xl font-bold tabular-nums text-ink">
                {form.quantity}
              </span>
              <button
                onClick={() => update('quantity', form.quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink"
              >
                <Plus size={16} />
              </button>
            </div>
          </FieldGroup>

          {/* Condition + Finish */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t.modal.condition}
              value={form.condition}
              options={CONDITIONS}
              onChange={(v) => update('condition', v)}
            />
            <SelectField
              label={t.modal.finish}
              value={form.finish}
              options={FINISHES}
              onChange={(v) => update('finish', v)}
            />
          </div>

          {/* Language + Edition */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t.modal.language}
              value={form.language}
              options={LANGUAGES}
              onChange={(v) => update('language', v)}
            />
            <TextField
              label={t.modal.edition}
              value={form.edition}
              placeholder={t.modal.editionPlaceholder}
              onChange={(v) => update('edition', v)}
            />
          </div>

          {/* Purchase price + Acquisition method */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t.modal.purchasePrice}
              value={form.purchasePrice}
              placeholder={t.modal.purchasePricePlaceholder}
              inputMode="decimal"
              onChange={(v) => update('purchasePrice', v)}
            />
            <SelectField
              label={t.modal.acquisition}
              value={form.acquisitionMethod}
              options={ACQUISITION_METHODS}
              onChange={(v) => update('acquisitionMethod', v)}
            />
          </div>

          {/* Acquisition date */}
          <FieldGroup label={t.modal.acquisitionDate}>
            <input
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => update('acquisitionDate', e.target.value)}
              className="h-11 w-full rounded-xl border border-line-soft bg-surface-3 px-3 text-sm text-ink focus:border-primary-soft focus:outline-none"
            />
          </FieldGroup>

          {/* Notes */}
          <FieldGroup label={t.modal.notes}>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder={t.modal.notesPlaceholder}
              rows={2}
              className="w-full resize-none rounded-xl border border-line-soft bg-surface-3 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-soft focus:outline-none"
            />
          </FieldGroup>

          {/* Favorite + Showcase toggles */}
          <div className="space-y-2">
            <ToggleRow
              icon={<Heart size={16} />}
              label={t.modal.favorite}
              description={t.modal.favoriteDesc}
              active={form.favorite}
              onClick={() => update('favorite', !form.favorite)}
            />
            <ToggleRow
              icon={<Star size={16} />}
              label={t.modal.showcaseCard}
              description={t.modal.showcaseDesc}
              active={form.showcase}
              onClick={() => update('showcase', !form.showcase)}
              accent="gold"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-5 py-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSave}
            isLoading={isPending}
            disabled={!telegramUser?.id}
          >
            {isEditing ? t.common.saveChanges : t.modal.addToCollection}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Form primitives ────────────────────────────────────────────── */

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  onChange: (value: string) => void;
}) {
  return (
    <FieldGroup label={label}>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-line-soft bg-surface-3 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-soft focus:outline-none"
      />
    </FieldGroup>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onChange: (value: string | null) => void;
}) {
  return (
    <FieldGroup label={label}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-11 w-full rounded-xl border border-line-soft bg-surface-3 px-3 text-sm text-ink focus:border-primary-soft focus:outline-none"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldGroup>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  active,
  onClick,
  accent = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  accent?: 'primary' | 'gold';
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
        active
          ? accent === 'gold'
            ? 'border-accent/40 bg-accent/10'
            : 'border-primary/40 bg-primary/10'
          : 'border-line-soft bg-surface-3'
      )}
    >
      <div
        className={cx(
          'flex h-8 w-8 items-center justify-center rounded-lg',
          active
            ? accent === 'gold'
              ? 'bg-accent/20 text-accent'
              : 'bg-primary/20 text-primary-soft'
            : 'bg-surface-2 text-ink-muted'
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className={cx('text-sm font-medium', active ? 'text-ink' : 'text-ink-soft')}>{label}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      <div
        className={cx(
          'h-5 w-9 rounded-full transition-colors',
          active
            ? accent === 'gold'
              ? 'bg-accent'
              : 'bg-primary'
            : 'bg-line'
        )}
      >
        <div
          className={cx(
            'h-4 w-4 rounded-full bg-white transition-transform mt-0.5',
            active ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </div>
    </button>
  );
}
