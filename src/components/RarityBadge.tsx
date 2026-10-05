import { useI18n } from '@/i18n';
import { rarityInfo, rarityLabel } from '@/lib/rarity';

interface Props {
  rarity: string | null | undefined;
  /** Hide the printed symbol (● ◆ ★ ...). */
  noSymbol?: boolean;
  className?: string;
}

/** A card rarity as a small colored badge: tier color, the symbol the card prints, and a translated name. */
export function RarityBadge({ rarity, noSymbol, className = '' }: Props) {
  const { locale } = useI18n();
  if (!rarity || !rarity.trim()) return null;
  const info = rarityInfo(rarity);
  return (
    <span title={rarity} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${info.badge} ${className}`}>
      {!noSymbol && info.symbol && <span aria-hidden="true">{info.symbol}</span>}
      <span className="truncate">{rarityLabel(rarity, locale)}</span>
    </span>
  );
}
