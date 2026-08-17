import { Heart, Layers, Minus, Plus, Trash2, Star, LayoutGrid, Package, Sparkles, X } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useCollectionList, useUpdateCollectionItem, useDeleteCollectionItem } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { useI18n } from '@/i18n';
import type { CollectionItem, CardVariant, CardLanguage, CardCondition, GradingCompany, PurchaseSource } from '@/types';
import { CARD_LANGUAGES, GRADING_COMPANIES, PURCHASE_SOURCES } from '@/types';

type SortOption = 'recent' | 'name' | 'value';
type ViewMode = 'cards' | 'sets';

interface SetCompletion {
  setName: string;
  owned: number;
  total: number;
  cards: CollectionItem[];
  totalValue: number;
}

const VARIANTS: { key: CardVariant; label: string; emoji: string }[] = [
  { key: 'normal', label: 'Normal', emoji: '🃏' },
  { key: 'holofoil', label: 'Holofoil', emoji: '✨' },
  { key: 'reverseHolofoil', label: 'Reverse Holo', emoji: '🌈' },
  { key: 'firstEdition', label: '1st Edition', emoji: '⭐' },
  { key: 'promo', label: 'Promo', emoji: '🎁' },
];

const CONDITION_KEYS: { key: CardCondition; color: string }[] = [
  { key: 'mint', color: 'text-green-400' },
  { key: 'near-mint', color: 'text-green-300' },
  { key: 'lightly-played', color: 'text-yellow-400' },
  { key: 'moderately-played', color: 'text-orange-400' },
  { key: 'heavily-played', color: 'text-red-400' },
  { key: 'damaged', color: 'text-red-600' },
];

function getConditionLabel(key: CardCondition, t: any): string {
  const map: Record<CardCondition, string> = {
    'mint': t.cardEdit?.mint ?? 'Mint',
    'near-mint': t.cardEdit?.nearMint ?? 'Near Mint',
    'lightly-played': t.cardEdit?.lightlyPlayed ?? 'Lightly Played',
    'moderately-played': t.cardEdit?.moderatelyPlayed ?? 'Moderately Played',
    'heavily-played': t.cardEdit?.heavilyPlayed ?? 'Heavily Played',
    'damaged': t.cardEdit?.damaged ?? 'Damaged',
  };
  return map[key] ?? key;
}

function getPurchaseSourceLabel(key: PurchaseSource, t: any): string {
  const map: Record<PurchaseSource, string> = {
    'pack': t.purchaseSources?.pack ?? 'Pack',
    'purchase': t.purchaseSources?.purchase ?? 'Purchase',
    'trade': t.purchaseSources?.trade ?? 'Trade',
    'gift': t.purchaseSources?.gift ?? 'Gift',
    'other': t.purchaseSources?.other ?? 'Other',
  };
  return map[key] ?? key;
}

function CardZoom({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
        <X size={20} className="text-white" />
      </button>
      <div onClick={e => e.stopPropagation()}>
        <img src={card.imageUrl ?? ''} alt={card.cardName} className="w-full max-w-xs rounded-2xl shadow-2xl" />
        <p className="text-white text-center font-bold mt-3">{card.cardName}</p>
        <p className="text-gray-400 text-center text-sm">{card.setName}</p>
      </div>
    </div>
  );
}

function EditCardModal({
  card, onSave, onClose,
}: {
  card: CollectionItem;
  onSave: (update: Partial<CollectionItem>) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const [variant, setVariant] = useState<CardVariant>(card.variant ?? 'normal');
  const [language, setLanguage] = useState<CardLanguage>(card.cardLanguage ?? 'en');
  const [condition, setCondition] = useState<CardCondition | null>(card.condition ?? null);
  const [purchasePrice, setPurchasePrice] = useState<string>(card.purchasePrice?.toString() ?? '');
  const [purchaseSource, setPurchaseSource] = useState<PurchaseSource | null>(card.purchaseSource ?? null);
  const [acquiredAt, setAcquiredAt] = useState<string>(card.acquiredAt?.split('T')[0] ?? '');
  const [notes, setNotes] = useState<string>(card.notes ?? '');
  const [inSleeve, setInSleeve] = useState<boolean>(card.inSleeve ?? false);
  const [inBinder, setInBinder] = useState<boolean>(card.inBinder ?? false);
  const [gradingCompany, setGradingCompany] = useState<GradingCompany | null>(card.gradingCompany ?? null);
  const [gradingScore, setGradingScore] = useState<string>(card.gradingScore?.toString() ?? '');
  const [gradingCertificate, setGradingCertificate] = useState<string>(card.gradingCertificate ?? '');
  const [gradeCentering, setGradeCentering] = useState<string>(card.gradeCentering?.toString() ?? '');
  const [gradeCorners, setGradeCorners] = useState<string>(card.gradeCorners?.toString() ?? '');
  const [gradeEdges, setGradeEdges] = useState<string>(card.gradeEdges?.toString() ?? '');
  const [gradeSurface, setGradeSurface] = useState<string>(card.gradeSurface?.toString() ?? '');
  const [step, setStep] = useState<'main' | 'variant' | 'language' | 'condition' | 'grading' | 'acquisition'>('main');

  const currentVariant = VARIANTS.find(v => v.key === variant);
  const currentLanguage = CARD_LANGUAGES.find(l => l.code === language);
  const conditionColor = CONDITION_KEYS.find(c => c.key === condition)?.color;

  const handleSave = () => {
    onSave({
      variant,
      cardLanguage: language,
      condition,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      purchaseSource,
      acquiredAt: acquiredAt || null,
      notes: notes || null,
      inSleeve,
      inBinder,
      gradingCompany,
      gradingScore: gradingScore ? parseFloat(gradingScore) : null,
      gradingCertificate: gradingCertificate || null,
      gradeCentering: gradeCentering ? parseFloat(gradeCentering) : null,
      gradeCorners: gradeCorners ? parseFloat(gradeCorners) : null,
      gradeEdges: gradeEdges ? parseFloat(gradeEdges) : null,
      gradeSurface: gradeSurface ? parseFloat(gradeSurface) : null,
      imageUrl: card.imageUrl,
      cardName: card.cardName,
      setName: card.setName,
      cardNumber: card.cardNumber,
      rarity: card.rarity,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {step === 'main' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{t.cardEdit?.title ?? 'Editar carta'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.cardName}</p>
              </div>
              <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">{t.common.cancel}</button>
            </div>

            <button onClick={() => setStep('variant')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">{currentVariant?.emoji}</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{t.variants.title}</p>
                <p className="text-sm text-white font-medium">{currentVariant?.label}</p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <button onClick={() => setStep('language')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">{currentLanguage?.flag}</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{t.cardLanguages.title}</p>
                <p className="text-sm text-white font-medium">{currentLanguage?.label}</p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <button onClick={() => setStep('condition')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">🔍</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{t.cardEdit?.condition ?? 'Condición'}</p>
                <p className={`text-sm font-medium ${conditionColor ?? 'text-gray-400'}`}>
                  {condition ? getConditionLabel(condition, t) : (t.cardEdit?.conditionNone ?? 'Sin especificar')}
                </p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <button onClick={() => setStep('grading')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">🏆</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{t.cardEdit?.grading ?? 'Grading profesional'}</p>
                <p className="text-sm text-white font-medium">
                  {gradingCompany ? `${gradingCompany}${gradingScore ? ` · ${gradingScore}` : ''}` : (t.cardEdit?.gradingNone ?? 'Sin grading')}
                </p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <button onClick={() => setStep('acquisition')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">💰</span>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{t.cardEdit?.acquisition ?? 'Adquisición'}</p>
                <p className="text-sm text-white font-medium">
                  {purchasePrice ? `${purchasePrice}€` : ''}{purchaseSource ? ` · ${PURCHASE_SOURCES.find(s => s.code === purchaseSource)?.emoji}` : ''}{!purchasePrice && !purchaseSource ? (t.cardEdit?.acquisitionNone ?? 'Sin especificar') : ''}
                </p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setInSleeve(!inSleeve)}
                className={`flex items-center gap-2 border rounded-xl px-3 py-3 transition-all ${inSleeve ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                <span className="text-lg">🛡️</span>
                <div className="text-left">
                  <p className="text-xs font-medium text-white">{t.cardEdit?.inSleeve ?? 'En funda'}</p>
                  <p className="text-[10px] text-gray-500">{inSleeve ? (t.common.yes ?? 'Sí') : (t.common.no ?? 'No')}</p>
                </div>
              </button>
              <button onClick={() => setInBinder(!inBinder)}
                className={`flex items-center gap-2 border rounded-xl px-3 py-3 transition-all ${inBinder ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                <span className="text-lg">📁</span>
                <div className="text-left">
                  <p className="text-xs font-medium text-white">{t.cardEdit?.inBinder ?? 'En álbum'}</p>
                  <p className="text-[10px] text-gray-500">{inBinder ? (t.common.yes ?? 'Sí') : (t.common.no ?? 'No')}</p>
                </div>
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.personalNotes ?? 'Notas personales'}</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t.cardEdit?.notesPlaceholder ?? 'Estado de la carta, historial, planes...'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none h-20" />
            </div>

            <button onClick={handleSave} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95 transition-transform">
              {t.common.saveChanges}
            </button>
          </>
        )}

        {step === 'variant' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.variants.select}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">{t.cardEdit?.back ?? '← Volver'}</button>
            </div>
            <div className="space-y-2">
              {VARIANTS.map(v => (
                <button key={v.key} onClick={() => { setVariant(v.key); setStep('main'); }}
                  className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ${variant === v.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                  <span className="text-xl">{v.emoji}</span>
                  <p className="text-sm text-white font-medium">{v.label}</p>
                  {variant === v.key && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'language' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.cardLanguages.select}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">{t.cardEdit?.back ?? '← Volver'}</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {CARD_LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => { setLanguage(lang.code); setStep('main'); }}
                  className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ${language === lang.code ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                  <span className="text-xl">{lang.flag}</span>
                  <p className="text-sm text-white font-medium">{lang.label}</p>
                  {language === lang.code && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'condition' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.cardEdit?.condition ?? 'Condición'}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">{t.cardEdit?.back ?? '← Volver'}</button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setCondition(null); setStep('main'); }}
                className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ${condition === null ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                <span className="text-xl">❓</span>
                <p className="text-sm text-white font-medium">{t.cardEdit?.conditionNone ?? 'Sin especificar'}</p>
                {condition === null && <span className="ml-auto text-blue-400">✓</span>}
              </button>
              {CONDITION_KEYS.map(c => (
                <button key={c.key} onClick={() => { setCondition(c.key); setStep('main'); }}
                  className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ${condition === c.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8'}`}>
                  <div className={`w-3 h-3 rounded-full ${c.color.replace('text-', 'bg-')}`} />
                  <p className={`text-sm font-medium ${c.color}`}>{getConditionLabel(c.key, t)}</p>
                  {condition === c.key && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'grading' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.cardEdit?.grading ?? 'Grading profesional'}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">{t.cardEdit?.back ?? '← Volver'}</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.gradingCompany ?? 'Empresa de grading'}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setGradingCompany(null)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${gradingCompany === null ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'}`}>
                    {t.cardEdit?.gradingNoneOption ?? 'Ninguna'}
                  </button>
                  {GRADING_COMPANIES.map(g => (
                    <button key={g.code} onClick={() => setGradingCompany(g.code)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${gradingCompany === g.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {gradingCompany && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.gradingScore ?? 'Nota global (1-10)'}</p>
                    <input type="number" min="1" max="10" step="0.5" value={gradingScore}
                      onChange={e => setGradingScore(e.target.value)} placeholder="ej: 9.5"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.gradingCertificate ?? 'Número de certificado'}</p>
                    <input type="text" value={gradingCertificate} onChange={e => setGradingCertificate(e.target.value)}
                      placeholder="ej: 12345678"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.subGrades ?? 'Sub-notas'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: t.cardEdit?.centering ?? 'Centrado', value: gradeCentering, set: setGradeCentering },
                        { label: t.cardEdit?.corners ?? 'Esquinas', value: gradeCorners, set: setGradeCorners },
                        { label: t.cardEdit?.edges ?? 'Bordes', value: gradeEdges, set: setGradeEdges },
                        { label: t.cardEdit?.surface ?? 'Superficie', value: gradeSurface, set: setGradeSurface },
                      ].map(sub => (
                        <div key={sub.label}>
                          <p className="text-[10px] text-gray-500 mb-1">{sub.label}</p>
                          <input type="number" min="1" max="10" step="0.5" value={sub.value}
                            onChange={e => sub.set(e.target.value)} placeholder="1-10"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <button onClick={() => setStep('main')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold">
                {t.cardEdit?.saveGrading ?? 'Guardar grading'}
              </button>
            </div>
          </>
        )}

        {step === 'acquisition' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.cardEdit?.acquisition ?? 'Adquisición'}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">{t.cardEdit?.back ?? '← Volver'}</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.purchasePrice ?? 'Precio pagado'}</p>
                <input type="number" min="0" step="0.01" value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.howObtained ?? 'Cómo la conseguiste'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {PURCHASE_SOURCES.map(s => (
                    <button key={s.code} onClick={() => setPurchaseSource(s.code)}
                      className={`flex flex-col items-center py-2.5 rounded-xl text-xs border transition-all ${purchaseSource === s.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'}`}>
                      <span className="text-lg mb-0.5">{s.emoji}</span>
                      {getPurchaseSourceLabel(s.code, t)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t.cardEdit?.acquiredDate ?? 'Fecha de adquisición'}</p>
                <input type="date" value={acquiredAt} onChange={e => setAcquiredAt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <button onClick={() => setStep('main')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold">
                {t.cardEdit?.saveAcquisition ?? 'Guardar adquisición'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CollectionPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');
  const [view, setView] = useState<ViewMode>('cards');
  const [editingCard, setEditingCard] = useState<CollectionItem | null>(null);
  const [zoomedCard, setZoomedCard] = useState<CollectionItem | null>(null);

  const { data: cards = [], isLoading } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: updateItem } = useUpdateCollectionItem();
  const { mutate: deleteItem } = useDeleteCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { formatPrice } = useCurrency();
  const { t } = useI18n();

  const updateEntry = useCallback((id: string, update: Partial<CollectionItem>) => {
    updateItem({ id, update });
  }, [updateItem]);

  const removeEntry = useCallback((id: string) => {
    deleteItem(id);
  }, [deleteItem]);

  const setGroups: SetCompletion[] = Object.values(
    cards.reduce((acc, card) => {
      const key = card.setName;
      if (!acc[key]) acc[key] = { setName: key, owned: 0, total: card.setTotal ?? 0, cards: [], totalValue: 0 };
      acc[key].owned += card.quantity;
      acc[key].cards.push(card);
      acc[key].totalValue += (card.marketPrice ?? card.tcgplayerPrice ?? 0) * card.quantity;
      return acc;
    }, {} as Record<string, SetCompletion>)
  ).sort((a, b) => b.owned - a.owned);

  const wishlistCardIds = new Set(wishlistItems.map(w => w.cardId));

  const filtered = [...cards]
    .filter(c => c.cardName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'name') return a.cardName.localeCompare(b.cardName);
      if (sort === 'value') {
        const va = a.marketPrice ?? a.tcgplayerPrice ?? 0;
        const vb = b.marketPrice ?? b.tcgplayerPrice ?? 0;
        return vb - va;
      }
      return 0;
    });

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const favorites = cards.filter(c => c.favorite).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando colección...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      {zoomedCard && <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />}

      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={(update) => { updateEntry(editingCard.id, update); setEditingCard(null); }}
          onClose={() => setEditingCard(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">{t.collection.title}</h1>
        <p className="text-sm text-gray-500">{t.collection.subtitle}</p>
      </div>

      {totalCards > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t.stats.cards, value: totalCards, color: 'text-blue-400' },
            { label: t.stats.unique, value: uniqueCards, color: 'text-purple-400' },
            { label: t.stats.favorites, value: favorites, color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          <button onClick={() => setView('cards')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <LayoutGrid size={13} />
            {t.collection.title}
          </button>
          <button onClick={() => setView('sets')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${view === 'sets' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <Package size={13} />
            {t.stats.sets}
          </button>
        </div>
      )}

      {view === 'cards' && (
        <>
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.collection.searchPlaceholder}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-gray-500">{t.collection.sort}</span>
            {(['recent', 'name', 'value'] as SortOption[]).map(opt => (
              <button key={opt} onClick={() => setSort(opt)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${sort === opt ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'}`}>
                {opt === 'recent' ? t.collection.sortRecent : opt === 'name' ? t.collection.sortName : t.collection.sortValue}
              </button>
            ))}
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Layers size={28} className="text-gray-600" />
              </div>
              <div>
                <p className="text-white font-semibold">{t.collection.noCardsYet}</p>
                <p className="text-sm text-gray-500 mt-1">{t.collection.noCardsYetDesc}</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {t.collection.noMatchesDesc.replace('{search}', search)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(card => (
                <CollectionCard
                  key={card.id}
                  card={card}
                  onUpdate={updateEntry}
                  onRemove={removeEntry}
                  onEdit={() => setEditingCard(card)}
                  onZoom={() => setZoomedCard(card)}
                  formatPrice={formatPrice}
                  t={t}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'sets' && (
        <div className="space-y-3">
          {setGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Package size={28} className="text-gray-600" />
              </div>
              <p className="text-white font-semibold">Sin sets todavía</p>
            </div>
          ) : (
            setGroups.map(group => {
              const total = group.total;
              const pct = total > 0 ? Math.round((group.cards.length / total) * 100) : 0;
              const missing = total - group.cards.length;

              return (
                <div key={group.setName} className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{group.setName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {group.cards.length}/{total > 0 ? total : '?'} cartas
                        {pct > 0 && <span className="text-blue-400 ml-1">· {pct}%</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {pct === 100 && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium block mb-1">✓ Completo</span>
                      )}
                      {group.totalValue > 0 && (
                        <span className="text-xs text-green-400 font-bold">{formatPrice(group.totalValue)}</span>
                      )}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group.cards.slice(0, 5).map(card => (
                      <img key={card.id} src={card.imageUrl ?? ''} alt={card.cardName}
                        className="h-14 w-10 object-cover rounded-lg shrink-0 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => setZoomedCard(card)} />
                    ))}
                    {group.cards.length > 5 && (
                      <div className="h-14 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-gray-400">+{group.cards.length - 5}</span>
                      </div>
                    )}
                  </div>

                  {missing > 0 && total > 0 && telegramUser?.id && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.name:"${encodeURIComponent(group.setName)}"&pageSize=250`);
                        const json = await res.json();
                        const ownedIds = new Set(group.cards.map(c => c.cardId));
                        const missingCards = (json.data ?? []).filter((c: any) => !ownedIds.has(c.id) && !wishlistCardIds.has(c.id));
                        missingCards.forEach((c: any) => {
                          createWishlistItem({
                            cardId: c.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
                            cardName: c.name, setName: c.set.name, cardNumber: c.number,
                            rarity: c.rarity ?? null, imageUrl: c.images?.small ?? null, setTotal: c.set?.total ?? null,
                          } as any);
                        });
                      }}
                      className="w-full py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-1.5"
                    >
                      <Heart size={12} />
                      Añadir {missing} que faltan a Wishlist
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CollectionCard({
  card, onUpdate, onRemove, onEdit, onZoom, formatPrice, t,
}: {
  card: CollectionItem;
  onUpdate: (id: string, update: Partial<CollectionItem>) => void;
  onRemove: (id: string) => void;
  onEdit: () => void;
  onZoom: () => void;
  formatPrice: (price: number | null | undefined) => string;
  t: any;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRemove = () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
    onRemove(card.id);
  };

  const price = card.marketPrice ?? card.tcgplayerPrice ?? null;
  const variantEmoji = VARIANTS.find(v => v.key === card.variant)?.emoji ?? '🃏';
  const langFlag = CARD_LANGUAGES.find(l => l.code === card.cardLanguage)?.flag ?? '🇬🇧';
  const conditionColor = CONDITION_KEYS.find(c => c.key === card.condition)?.color;

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      <div className="relative cursor-pointer" onClick={onZoom}>
        <img src={card.imageUrl ?? ''} alt={card.cardName} className="w-full aspect-[2/3] object-cover" loading="lazy" />
        <button onClick={e => { e.stopPropagation(); onUpdate(card.id, { favorite: !card.favorite }); }}
          className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <Heart size={15} className={card.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
        </button>
        {card.favorite && (
          <div className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-yellow-400/90 flex items-center justify-center">
            <Star size={12} className="fill-black text-black" />
          </div>
        )}
        {card.gradingCompany && (
          <div className="absolute top-1.5 left-1.5 bg-yellow-400/90 rounded-full px-1.5 py-0.5">
            <span className="text-[9px] font-bold text-black">{card.gradingCompany} {card.gradingScore}</span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">{variantEmoji}</span>
          <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">{langFlag}</span>
          {card.inSleeve && <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">🛡️</span>}
          {card.inBinder && <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">📁</span>}
        </div>
      </div>

      <div className="p-2.5 flex-1 space-y-1">
        <p className="text-xs font-bold truncate text-white">{card.cardName}</p>
        <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
        {card.condition && <p className={`text-[10px] font-medium ${conditionColor}`}>{getConditionLabel(card.condition, t)}</p>}
        {price && <p className="text-[10px] text-green-400 font-medium">{formatPrice(price)}</p>}
        {card.purchasePrice && <p className="text-[10px] text-gray-500">{t.cardEdit?.purchasePrice ?? 'Pagado'}: {formatPrice(card.purchasePrice)}</p>}
      </div>

      <div className="flex items-center justify-between gap-1 px-2.5 pb-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => card.quantity > 1 && onUpdate(card.id, { quantity: card.quantity - 1 })} disabled={card.quantity <= 1}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-40">
            <Minus size={13} />
          </button>
          <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">{card.quantity}</span>
          <button onClick={() => onUpdate(card.id, { quantity: card.quantity + 1 })}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
            <Plus size={13} />
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-blue-400">
            <Sparkles size={13} />
          </button>
          <button onClick={handleRemove}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${confirmDelete ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-white/5 text-gray-500'}`}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}