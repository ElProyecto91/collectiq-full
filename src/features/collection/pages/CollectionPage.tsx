import { Heart, Layers, Minus, Plus, Trash2, Star, LayoutGrid, Package, Sparkles, X, Download, Upload, BookOpen, ChevronLeft, ChevronRight, QrCode, MapPin, ShoppingBag } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useCollectionList, useUpdateCollectionItem, useDeleteCollectionItem } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { useI18n } from '@/i18n';
import { useActiveTCG, TCG_OPTIONS } from '@/hooks/use-active-tcg';
import type { CollectionItem, CardVariant, CardLanguage, CardCondition, GradingCompany, PurchaseSource } from '@/types';
import { CARD_LANGUAGES, GRADING_COMPANIES, PURCHASE_SOURCES } from '@/types';
import { ImportCSVModal } from '@/components/ImportCSVModal';
import { RoutePaths } from '@/config';

type SortOption = 'recent' | 'name' | 'value';
type ViewMode = 'cards' | 'sets' | 'album';
type AlbumLayout = 1 | 2 | 3 | 4;

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

const SLEEVE_TYPES = [
  { key: null, label: 'Sin funda', emoji: '❌' },
  { key: 'penny', label: 'Penny Sleeve', emoji: '🔵' },
  { key: 'toploader', label: 'Top Loader', emoji: '🟦' },
  { key: 'binder', label: 'Binder Sleeve', emoji: '📁' },
  { key: 'onetouch', label: 'One Touch', emoji: '💎' },
  { key: 'magnetic', label: 'Magnético', emoji: '🧲' },
];

const ALBUM_BACKGROUNDS = [
  { key: 'dark', label: 'Oscuro', bg: '#0a0a0f', border: '#ffffff15' },
  { key: 'leather', label: 'Cuero', bg: '#1a0f0a', border: '#8B4513aa' },
  { key: 'green', label: 'Verde', bg: '#0a1a0f', border: '#22c55e33' },
  { key: 'navy', label: 'Marino', bg: '#0a0f1a', border: '#3b82f633' },
  { key: 'purple', label: 'Morado', bg: '#0f0a1a', border: '#a855f733' },
];

function getConditionLabel(key: CardCondition, t: any): string {
  const map: Partial<Record<string, string>> = {
    'mint': t.cardEdit?.mint ?? 'Mint',
    'near-mint': t.cardEdit?.nearMint ?? 'Near Mint',
    'NM': t.cardEdit?.nearMint ?? 'Near Mint',
    'lightly-played': t.cardEdit?.lightlyPlayed ?? 'Lightly Played',
    'LP': t.cardEdit?.lightlyPlayed ?? 'Lightly Played',
    'moderately-played': t.cardEdit?.moderatelyPlayed ?? 'Moderately Played',
    'MP': t.cardEdit?.moderatelyPlayed ?? 'Moderately Played',
    'heavily-played': t.cardEdit?.heavilyPlayed ?? 'Heavily Played',
    'HP': t.cardEdit?.heavilyPlayed ?? 'Heavily Played',
    'damaged': t.cardEdit?.damaged ?? 'Damaged',
    'DMG': t.cardEdit?.damaged ?? 'Damaged',
  };
  return map[key] ?? key;
}

function exportToCSV(cards: CollectionItem[], filename: string) {
  const headers = [
    'Nombre', 'Set', 'Numero', 'Rareza', 'Variante', 'Idioma', 'Condicion',
    'Cantidad', 'Precio mercado', 'Precio pagado', 'Fuente', 'Fecha adquisicion',
    'Grading', 'Nota grading', 'Certificado', 'Centrado', 'Esquinas', 'Bordes', 'Superficie',
    'En funda', 'Tipo funda', 'En album', 'Ubicacion', 'Notas', 'Imagen',
  ];
  const rows = cards.map(card => [
    card.cardName, card.setName, card.cardNumber, card.rarity ?? '',
    card.variant ?? 'normal',
    CARD_LANGUAGES.find(l => l.code === card.cardLanguage)?.label ?? card.cardLanguage ?? 'en',
    card.condition ?? '', card.quantity,
    card.marketPrice ?? card.tcgplayerPrice ?? '',
    card.purchasePrice ?? '', card.purchaseSource ?? '',
    card.acquiredAt ? card.acquiredAt.split('T')[0] : '',
    card.gradingCompany ?? '', card.gradingScore ?? '', card.gradingCertificate ?? '',
    card.gradeCentering ?? '', card.gradeCorners ?? '', card.gradeEdges ?? '', card.gradeSurface ?? '',
    card.inSleeve ? 'Si' : 'No',
    (card as any).sleeveType ?? '',
    card.inBinder ? 'Si' : 'No',
    (card as any).storageLocation ?? '',
    card.notes ?? '',
    card.imageUrl ?? '',
  ]);
  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
  ).join('\n');
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows);
  const a = document.createElement('a');
  a.setAttribute('href', dataUri);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── TCG SELECTOR — universal, navega si el TCG tiene route ────
function TCGSelector({ activeTCG, setActiveTCG }: { activeTCG: string; setActiveTCG: (tcg: any) => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {TCG_OPTIONS.map(tcg => {
        const isActive = activeTCG === tcg.key;
        return (
          <button
            key={tcg.key}
            onClick={() => {
              // Si tiene ruta propia, navegar directamente
              if (tcg.route) {
                navigate(tcg.route);
                return;
              }
              setActiveTCG(tcg.key);
            }}
            className={'shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium transition-all border ' + (
              isActive
                ? 'border-opacity-100 text-white'
                : tcg.available
                  ? 'bg-white/5 text-gray-400 border-white/10 active:scale-95'
                  : 'bg-white/5 text-gray-600 border-white/8 active:scale-95'
            )}
            style={isActive ? { backgroundColor: tcg.color + '22', borderColor: tcg.color, color: tcg.color } : {}}>
            <span
              className="w-6 h-6"
              style={{ color: isActive ? tcg.color : tcg.available ? '#9ca3af' : '#4b5563' }}
              dangerouslySetInnerHTML={{ __html: tcg.icon }}
            />
            <span className="whitespace-nowrap">{tcg.label}</span>
            {!tcg.available && <span className="text-[8px] text-gray-600 -mt-0.5">pronto</span>}
          </button>
        );
      })}
    </div>
  );
}

function AlbumView({ cards, onZoom }: { cards: CollectionItem[]; onZoom: (card: CollectionItem) => void }) {
  const [layout, setLayout] = useState<AlbumLayout>(3);
  const [page, setPage] = useState(0);
  const [bgKey, setBgKey] = useState('dark');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const bg = ALBUM_BACKGROUNDS.find(b => b.key === bgKey) ?? ALBUM_BACKGROUNDS[0];
  const cardsPerPage = layout * layout;
  const totalPages = Math.ceil(cards.length / cardsPerPage);
  const pageCards = cards.slice(page * cardsPerPage, (page + 1) * cardsPerPage);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && page < totalPages - 1) setPage(p => p + 1);
      if (diff < 0 && page > 0) setPage(p => p - 1);
    }
    setTouchStart(null);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([1, 2, 3, 4] as AlbumLayout[]).map(l => (
            <button key={l} onClick={() => { setLayout(l); setPage(0); }}
              className={'w-8 h-8 rounded-lg text-xs font-bold border transition-all ' + (layout === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-gray-400 border-white/10')}>
              {l}x{l}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {ALBUM_BACKGROUNDS.map(b => (
            <button key={b.key} onClick={() => setBgKey(b.key)}
              className={'w-6 h-6 rounded-full border-2 transition-all ' + (bgKey === b.key ? 'border-white scale-110' : 'border-transparent')}
              style={{ backgroundColor: b.bg }} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl p-3 min-h-64"
        style={{ backgroundColor: bg.bg, border: '2px solid ' + bg.border }}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30">
            <ChevronLeft size={14} className="text-white" />
          </button>
          <p className="text-[10px] text-white/50 font-medium">{page + 1} / {totalPages || 1}</p>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30">
            <ChevronRight size={14} className="text-white" />
          </button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(' + layout + ', 1fr)' }}>
          {Array.from({ length: cardsPerPage }).map((_, i) => {
            const card = pageCards[i];
            return (
              <div key={i}
                className={'rounded-xl overflow-hidden border transition-all ' + (card ? 'cursor-pointer active:scale-95' : 'opacity-20')}
                style={{ borderColor: bg.border, aspectRatio: '2/3', backgroundColor: card ? 'transparent' : bg.border }}
                onClick={() => card && onZoom(card)}>
                {card ? (
                  <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/20 text-xs">+</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {pageCards.length > 0 && (
          <p className="text-center text-[10px] text-white/30 mt-3">
            Cartas {page * cardsPerPage + 1}–{Math.min((page + 1) * cardsPerPage, cards.length)} de {cards.length}
          </p>
        )}
      </div>
      <p className="text-center text-[10px] text-gray-600">Desliza para pasar pagina</p>
    </div>
  );
}

function QRModal({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  const qrData = JSON.stringify({
    id: card.cardId, name: card.cardName, set: card.setName,
    number: card.cardNumber, variant: card.variant ?? 'normal',
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 space-y-4 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Código QR</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X size={16} className="text-white" />
          </button>
        </div>
        <div className="flex justify-center bg-white p-4 rounded-xl">
          <QRCodeSVG value={qrData} size={200} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-white">{card.cardName}</p>
          <p className="text-xs text-gray-500">{card.setName} · {card.cardNumber}</p>
          <p className="text-[10px] text-gray-600">Escanea para identificar esta carta</p>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ cards, setGroups, onClose }: { cards: CollectionItem[]; setGroups: SetCompletion[]; onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const handleExport = (subset: CollectionItem[], filename: string) => {
    setExporting(true);
    setTimeout(() => { exportToCSV(subset, filename); setExporting(false); onClose(); }, 300);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Exportar coleccion</p>
            <p className="text-xs text-gray-500 mt-0.5">CSV compatible con Excel y Google Sheets</p>
          </div>
          <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
        </div>
        <button onClick={() => handleExport(cards, 'collectiq-completo.csv')} disabled={exporting}
          className="w-full flex items-center gap-3 bg-blue-600 rounded-xl px-4 py-3 text-left active:scale-95 transition-transform">
          <Download size={18} className="text-white shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Exportar todo</p>
            <p className="text-xs text-blue-200">{cards.length} cartas</p>
          </div>
        </button>
        {setGroups.length > 0 && (
          <>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Por set</p>
            {setGroups.map(group => (
              <button key={group.setName}
                onClick={() => handleExport(group.cards, 'collectiq-' + group.setName.replace(/\s+/g, '-').toLowerCase() + '.csv')}
                disabled={exporting}
                className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left active:scale-95 transition-transform">
                <Download size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{group.setName}</p>
                  <p className="text-xs text-gray-500">{group.cards.length} cartas</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CardZoom({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
        <X size={20} className="text-white" />
      </button>
      <div onClick={e => e.stopPropagation()}>
        <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-full max-w-xs rounded-2xl shadow-2xl" />
        <p className="text-white text-center font-bold mt-3">{card.cardName}</p>
        <p className="text-gray-400 text-center text-sm">{card.setName}</p>
      </div>
    </div>
  );
}

function SellOnMarketModal({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Vender en Marketplace</p>
          <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
        </div>
        <div className="flex gap-3 bg-white/5 rounded-xl p-3">
          {card.imageUrl && <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-12 h-16 object-cover rounded-lg shrink-0" />}
          <div>
            <p className="text-sm font-bold text-white">{card.cardName}</p>
            <p className="text-xs text-gray-400">{card.setName}</p>
            {card.cardNumber && <p className="text-xs text-gray-500">#{card.cardNumber}</p>}
            {card.marketPrice && <p className="text-sm font-bold text-green-400 mt-1">Precio mercado: €{card.marketPrice.toFixed(2)}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'sell', label: '💚 Vender', color: 'bg-green-500/15 border-green-500/25 text-green-400' },
            { type: 'trade', label: '🔄 Cambiar', color: 'bg-blue-500/15 border-blue-500/25 text-blue-400' },
            { type: 'want', label: '🔍 Buscar', color: 'bg-purple-500/15 border-purple-500/25 text-purple-400' },
          ].map(opt => (
            <button key={opt.type}
              onClick={() => {
                navigate(RoutePaths.Marketplace, {
                  state: {
                    prefill: {
                      listing_type: opt.type, tcg: card.tcg || 'pokemon',
                      item_name: card.cardName || '', set_name: card.setName || '',
                      card_number: card.cardNumber || '', rarity: card.rarity || '',
                      image_url: card.imageUrl || '',
                      price: card.marketPrice ? card.marketPrice.toFixed(2) : '',
                      contact_telegram: telegramUser?.username || '',
                    }, tab: 'create',
                  }
                });
                onClose();
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${opt.color}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 text-center">Se abrirá el Marketplace con los datos de esta carta ya rellenados.</p>
      </div>
    </div>
  );
}

function EditCardModal({ card, onSave, onClose }: {
  card: CollectionItem; onSave: (update: Partial<CollectionItem>) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [variant, setVariant] = useState<CardVariant>((card.variant as CardVariant) ?? 'normal');
  const [language, setLanguage] = useState<CardLanguage>((card.cardLanguage as CardLanguage) ?? 'en');
  const [condition, setCondition] = useState<CardCondition | null>((card.condition as CardCondition) ?? null);
  const [quantity, setQuantity] = useState<number>(card.quantity ?? 1);
  const [purchasePrice, setPurchasePrice] = useState<string>(card.purchasePrice?.toString() ?? '');
  const [purchaseSource, setPurchaseSource] = useState<PurchaseSource | null>(card.purchaseSource as PurchaseSource ?? null);
  const [acquiredAt, setAcquiredAt] = useState<string>(card.acquiredAt?.split('T')[0] ?? '');
  const [notes, setNotes] = useState<string>(card.notes ?? '');
  const [inSleeve, setInSleeve] = useState<boolean>(card.inSleeve ?? false);
  const [inBinder, setInBinder] = useState<boolean>(card.inBinder ?? false);
  const [sleeveType, setSleeveType] = useState<string | null>((card as any).sleeveType ?? null);
  const [storageLocation, setStorageLocation] = useState<string>((card as any).storageLocation ?? '');
  const [gradingCompany, setGradingCompany] = useState<GradingCompany | null>((card.gradingCompany as GradingCompany) ?? null);
  const [gradingScore, setGradingScore] = useState<string>(card.gradingScore?.toString() ?? '');
  const [gradingCertificate, setGradingCertificate] = useState<string>(card.gradingCertificate ?? '');
  const [gradeCentering, setGradeCentering] = useState<string>(card.gradeCentering?.toString() ?? '');
  const [gradeCorners, setGradeCorners] = useState<string>(card.gradeCorners?.toString() ?? '');
  const [gradeEdges, setGradeEdges] = useState<string>(card.gradeEdges?.toString() ?? '');
  const [gradeSurface, setGradeSurface] = useState<string>(card.gradeSurface?.toString() ?? '');
  const [editCardId, setEditCardId] = useState<string>(card.cardId ?? '');
  const [editSetName, setEditSetName] = useState<string>(card.setName ?? '');
  const [step, setStep] = useState<'main' | 'variant' | 'language' | 'condition' | 'grading' | 'acquisition' | 'sleeve' | 'card-id'>('main');

  const currentVariant = VARIANTS.find(v => v.key === variant);
  const currentLanguage = CARD_LANGUAGES.find(l => l.code === language);
  const conditionColor = CONDITION_KEYS.find(c => c.key === condition)?.color;
  const currentSleeve = SLEEVE_TYPES.find(s => s.key === sleeveType);
  const marketPrice = card.marketPrice ?? card.tcgplayerPrice ?? null;
  const roi = purchasePrice && marketPrice ? ((marketPrice - parseFloat(purchasePrice)) / parseFloat(purchasePrice) * 100) : null;

  const handleSave = () => {
    onSave({
      variant, cardLanguage: language, condition, quantity,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      purchaseSource, acquiredAt: acquiredAt || null, notes: notes || null,
      inSleeve, inBinder,
      ...(({ sleeveType, storageLocation }) => ({ sleeveType, storageLocation: storageLocation || null }))({ sleeveType, storageLocation }),
      gradingCompany,
      gradingScore: gradingScore ? parseFloat(gradingScore) : null,
      gradingCertificate: gradingCertificate || null,
      gradeCentering: gradeCentering ? parseFloat(gradeCentering) : null,
      gradeCorners: gradeCorners ? parseFloat(gradeCorners) : null,
      gradeEdges: gradeEdges ? parseFloat(gradeEdges) : null,
      gradeSurface: gradeSurface ? parseFloat(gradeSurface) : null,
      cardId: editCardId || card.cardId,
      setName: editSetName || card.setName,
    } as any);
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
            <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 mb-2">Cantidad</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white"><Minus size={14} /></button>
                <span className="text-xl font-bold text-white min-w-[2rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white"><Plus size={14} /></button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-500">Precio pagado</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                <span className="text-xs text-gray-500">EUR</span>
              </div>
              {roi !== null && marketPrice && (
                <div className={'flex items-center gap-2 rounded-xl px-3 py-2 ' + (roi >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20')}>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500">Precio mercado: {formatPrice(marketPrice)}</p>
                    <p className={'text-sm font-bold ' + (roi >= 0 ? 'text-green-400' : 'text-red-400')}>
                      ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      <span className="text-xs ml-1">({roi >= 0 ? '+' : ''}{formatPrice(marketPrice - parseFloat(purchasePrice))})</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
            {[
              { label: t.variants.title, value: currentVariant?.label, emoji: currentVariant?.emoji, step: 'variant' as const },
              { label: t.cardLanguages.title, value: currentLanguage?.label, emoji: currentLanguage?.flag, step: 'language' as const },
              { label: t.cardEdit?.condition ?? 'Condicion', value: condition ? getConditionLabel(condition, t) : 'Sin especificar', emoji: '🔍', step: 'condition' as const, color: conditionColor },
              { label: 'Estado de funda', value: currentSleeve?.label ?? 'Sin funda', emoji: currentSleeve?.emoji ?? '❌', step: 'sleeve' as const },
              { label: t.cardEdit?.grading ?? 'Grading', value: gradingCompany ? gradingCompany + (gradingScore ? ' · ' + gradingScore : '') : 'Sin grading', emoji: '🏆', step: 'grading' as const },
              { label: 'Adquisicion', value: !acquiredAt && !purchaseSource ? 'Sin especificar' : (acquiredAt || '') + (purchaseSource ? ' · ' + (PURCHASE_SOURCES.find(s => s.code === purchaseSource)?.emoji ?? '') : ''), emoji: '📅', step: 'acquisition' as const },
            ].map(item => (
              <button key={item.step} onClick={() => setStep(item.step)} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
                <span className="text-xl">{item.emoji}</span>
                <div className="flex-1"><p className="text-xs text-gray-500">{item.label}</p><p className={'text-sm font-medium ' + (item.color ?? 'text-white')}>{item.value}</p></div>
                <span className="text-gray-500 text-xs">›</span>
              </button>
            ))}
            <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin size={12} />Ubicación física</p>
              <input value={storageLocation} onChange={e => setStorageLocation(e.target.value)} placeholder="Ej: Caja azul, álbum 2, página 5..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setInSleeve(!inSleeve)} className={'flex items-center gap-2 border rounded-xl px-3 py-3 transition-all ' + (inSleeve ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                <span className="text-lg">🛡️</span>
                <div className="text-left"><p className="text-xs font-medium text-white">En funda</p><p className="text-[10px] text-gray-500">{inSleeve ? 'Si' : 'No'}</p></div>
              </button>
              <button onClick={() => setInBinder(!inBinder)} className={'flex items-center gap-2 border rounded-xl px-3 py-3 transition-all ' + (inBinder ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                <span className="text-lg">📁</span>
                <div className="text-left"><p className="text-xs font-medium text-white">En album</p><p className="text-[10px] text-gray-500">{inBinder ? 'Si' : 'No'}</p></div>
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Notas personales</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Estado de la carta, historial, planes..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none h-20" />
            </div>
            <button onClick={() => setStep('card-id')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
              <span className="text-xl">🔧</span>
              <div className="flex-1"><p className="text-xs text-gray-500">ID de carta / Set</p><p className="text-sm text-white font-medium truncate">{editCardId || card.cardId}</p></div>
              <span className="text-gray-500 text-xs">›</span>
            </button>
            <button onClick={handleSave} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95 transition-transform">{t.common.saveChanges}</button>
          </>
        )}

        {step === 'variant' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{t.variants.select}</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-2">
              {VARIANTS.map(v => (
                <button key={v.key} onClick={() => { setVariant(v.key); setStep('main'); }}
                  className={'w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ' + (variant === v.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                  <span className="text-xl">{v.emoji}</span><p className="text-sm text-white font-medium">{v.label}</p>
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
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {CARD_LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => { setLanguage(lang.code); setStep('main'); }}
                  className={'w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ' + (language === lang.code ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                  <span className="text-xl">{lang.flag}</span><p className="text-sm text-white font-medium">{lang.label}</p>
                  {language === lang.code && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'condition' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Condicion</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setCondition(null); setStep('main'); }}
                className={'w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ' + (condition === null ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                <span className="text-xl">❓</span><p className="text-sm text-white font-medium">Sin especificar</p>
                {condition === null && <span className="ml-auto text-blue-400">✓</span>}
              </button>
              {CONDITION_KEYS.map(c => (
                <button key={c.key} onClick={() => { setCondition(c.key); setStep('main'); }}
                  className={'w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ' + (condition === c.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                  <div className={'w-3 h-3 rounded-full ' + c.color.replace('text-', 'bg-')} />
                  <p className={'text-sm font-medium ' + c.color}>{getConditionLabel(c.key, t)}</p>
                  {condition === c.key && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'sleeve' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Estado de funda</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-2">
              {SLEEVE_TYPES.map(s => (
                <button key={String(s.key)} onClick={() => { setSleeveType(s.key); setInSleeve(s.key !== null); setStep('main'); }}
                  className={'w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left transition-all ' + (sleeveType === s.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
                  <span className="text-xl">{s.emoji}</span><p className="text-sm text-white font-medium">{s.label}</p>
                  {sleeveType === s.key && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'grading' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Grading profesional</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Empresa de grading</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setGradingCompany(null)}
                    className={'py-2 rounded-xl text-xs font-medium border transition-all ' + (gradingCompany === null ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                    Ninguna
                  </button>
                  {GRADING_COMPANIES.map(g => (
                    <button key={g.code} onClick={() => setGradingCompany(g.code)}
                      className={'py-2 rounded-xl text-xs font-medium border transition-all ' + (gradingCompany === g.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {gradingCompany && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Nota global (1-10)</p>
                    <input type="number" min="1" max="10" step="0.5" value={gradingScore} onChange={e => setGradingScore(e.target.value)} placeholder="ej: 9.5"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Numero de certificado</p>
                    <input type="text" value={gradingCertificate} onChange={e => setGradingCertificate(e.target.value)} placeholder="ej: 12345678"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Sub-notas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Centrado', value: gradeCentering, set: setGradeCentering },
                        { label: 'Esquinas', value: gradeCorners, set: setGradeCorners },
                        { label: 'Bordes', value: gradeEdges, set: setGradeEdges },
                        { label: 'Superficie', value: gradeSurface, set: setGradeSurface },
                      ].map(sub => (
                        <div key={sub.label}>
                          <p className="text-[10px] text-gray-500 mb-1">{sub.label}</p>
                          <input type="number" min="1" max="10" step="0.5" value={sub.value} onChange={e => sub.set(e.target.value)} placeholder="1-10"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <button onClick={() => setStep('main')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95">Guardar grading</button>
            </div>
          </>
        )}

        {step === 'acquisition' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Adquisicion</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Fecha de adquisicion</p>
                <input type="date" value={acquiredAt} onChange={e => setAcquiredAt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Fuente de adquisicion</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setPurchaseSource(null)}
                    className={'py-2 rounded-xl text-xs font-medium border transition-all ' + (purchaseSource === null ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                    Ninguna
                  </button>
                  {PURCHASE_SOURCES.map(s => (
                    <button key={s.code} onClick={() => setPurchaseSource(s.code)}
                      className={'py-2 rounded-xl text-xs font-medium border transition-all ' + (purchaseSource === s.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setStep('main')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95">Guardar</button>
            </div>
          </>
        )}

        {step === 'card-id' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">ID de carta / Set</p>
              <button onClick={() => setStep('main')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Card ID</p>
                <input type="text" value={editCardId} onChange={e => setEditCardId(e.target.value)} placeholder="ej: sv3pt5-151"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Set</p>
                <input type="text" value={editSetName} onChange={e => setEditSetName(e.target.value)} placeholder="ej: Scarlet & Violet 151"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              </div>
              <button onClick={() => setStep('main')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95">Guardar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── COLLECTION PAGE ───────────────────────────────────────────
export function CollectionPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const telegramUser = useUserStore(s => s.telegramUser);
  const { activeTCG, setActiveTCG } = useActiveTCG();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');
  const [filterSet, setFilterSet] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [editingCard, setEditingCard] = useState<CollectionItem | null>(null);
  const [zoomedCard, setZoomedCard] = useState<CollectionItem | null>(null);
  const [qrCard, setQrCard] = useState<CollectionItem | null>(null);
  const [marketCard, setMarketCard] = useState<CollectionItem | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: allCards = [], isLoading, refetch } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: updateEntry } = useUpdateCollectionItem();
  const { mutate: removeEntry } = useDeleteCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();

  // TCG actual — si tiene route, redirige automáticamente
  const currentTCG = TCG_OPTIONS.find(t => t.key === activeTCG);
  useEffect(() => {
    if (currentTCG?.route) {
      navigate(currentTCG.route, { replace: true });
    }
  }, [activeTCG, currentTCG, navigate]);

  // Determinar si mostrar "próximamente"
  // Un TCG sin route y sin available muestra coming soon
  const showComingSoon = !!currentTCG && !currentTCG.route && !currentTCG.available;

  // Filtrar cartas según TCG activo
  const tcgKey = activeTCG === 'all' ? null : activeTCG === 'one-piece' ? 'onepiece' : activeTCG;
  const cards = tcgKey ? allCards.filter(c => c.tcg === tcgKey) : allCards;

  const setGroups: SetCompletion[] = Object.values(
    cards.reduce((acc, c) => {
      const key = c.setName ?? 'Sin set';
      if (!acc[key]) acc[key] = { setName: key, owned: 0, total: 0, cards: [], totalValue: 0 };
      acc[key].owned += c.quantity;
      acc[key].cards.push(c);
      acc[key].totalValue += (c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity;
      return acc;
    }, {} as Record<string, SetCompletion>)
  ).sort((a, b) => b.owned - a.owned);

  const wishlistCardIds = new Set(wishlistItems.map(w => w.cardId));
  const availableSets = [...new Set(cards.map(c => c.setName ?? '').filter(Boolean))].sort();
  const availableRarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))].sort() as string[];

  const filtered = [...cards]
    .filter(c => (c.cardName ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter(c => filterSet ? c.setName === filterSet : true)
    .filter(c => filterRarity ? (c.rarity ?? '') === filterRarity : true)
    .sort((a, b) => {
      if (sort === 'recent') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (sort === 'name') return (a.cardName ?? '').localeCompare(b.cardName ?? '');
      if (sort === 'value') return (b.marketPrice ?? b.tcgplayerPrice ?? 0) - (a.marketPrice ?? a.tcgplayerPrice ?? 0);
      return 0;
    });

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const favorites = cards.filter(c => c.favorite).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><p className="text-gray-500 text-sm">Cargando coleccion...</p></div>;
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">
      {zoomedCard && <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />}
      {qrCard && <QRModal card={qrCard} onClose={() => setQrCard(null)} />}
      {marketCard && <SellOnMarketModal card={marketCard} onClose={() => setMarketCard(null)} />}
      {editingCard && (
        <EditCardModal card={editingCard}
          onSave={(update) => { updateEntry({ id: editingCard.id, update }); setEditingCard(null); }}
          onClose={() => setEditingCard(null)} />
      )}
      {showExport && <ExportModal cards={cards} setGroups={setGroups} onClose={() => setShowExport(false)} />}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} onSuccess={() => { refetch(); }} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.collection.title}</h1>
          <p className="text-sm text-gray-500">{t.collection.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 active:scale-95 transition-transform">
            <Upload size={16} />
          </button>
          {!showComingSoon && cards.length > 0 && (
            <button onClick={() => setShowExport(true)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 active:scale-95 transition-transform">
              <Download size={16} />
            </button>
          )}
          {!showComingSoon && cards.length > 0 && activeTCG === 'pokemon' && (
            <button
              id="refresh-prices-btn"
              onClick={async () => {
                if (!telegramUser?.id) return;
                const btn = document.getElementById('refresh-prices-btn');
                if (btn) btn.style.opacity = '0.5';
                await fetch('/api/pokemon-update-prices', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ telegramUserId: telegramUser.id }),
                });
                if (btn) btn.style.opacity = '1';
                refetch();
              }}
              className="w-9 h-9 rounded-xl bg-green-600/20 border border-green-500/30 flex items-center justify-center text-green-400 active:scale-95 transition-transform">
              <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>

      <TCGSelector activeTCG={activeTCG} setActiveTCG={setActiveTCG} />

      {showComingSoon ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: (currentTCG?.color ?? '#6366f1') + '22' }}>
            <span className="w-10 h-10" style={{ color: currentTCG?.color }} dangerouslySetInnerHTML={{ __html: currentTCG?.icon ?? '' }} />
          </div>
          <div>
            <p className="text-white font-bold text-lg">{currentTCG?.label}</p>
            <p className="text-sm text-gray-500 mt-1">El catalogo de {currentTCG?.label} estara disponible proximamente.</p>
          </div>
          <button onClick={() => setActiveTCG('pokemon')} className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium active:scale-95 transition-transform">
            Ver Pokemon TCG
          </button>
        </div>
      ) : (
        <>
          {totalCards > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t.stats.cards, value: totalCards, color: 'text-blue-400' },
                { label: t.stats.unique, value: uniqueCards, color: 'text-purple-400' },
                { label: t.stats.favorites, value: favorites, color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
                  <p className={'text-xl font-bold ' + color}>{value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          )}

          {cards.length > 0 && (
            <div className="flex gap-2 bg-white/5 rounded-xl p-1">
              {[
                { key: 'cards', icon: <LayoutGrid size={13} />, label: 'Cartas' },
                { key: 'sets', icon: <Package size={13} />, label: 'Sets' },
                { key: 'album', icon: <BookOpen size={13} />, label: 'Album' },
              ].map(v => (
                <button key={v.key} onClick={() => setView(v.key as ViewMode)}
                  className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ' + (view === v.key ? 'bg-blue-600 text-white' : 'text-gray-400')}>
                  {v.icon}{v.label}
                </button>
              ))}
            </div>
          )}

          {view === 'album' && <AlbumView cards={cards} onZoom={setZoomedCard} />}

          {view === 'cards' && (
            <>
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t.collection.searchPlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              </div>
              {availableSets.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button onClick={() => setFilterSet('')}
                    className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + (!filterSet ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 text-gray-400')}>
                    Todos los sets
                  </button>
                  {availableSets.map(s => (
                    <button key={s} onClick={() => setFilterSet(filterSet === s ? '' : s)}
                      className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all truncate max-w-[120px] ' + (filterSet === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 text-gray-400')}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {availableRarities.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button onClick={() => setFilterRarity('')}
                    className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + (!filterRarity ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/5 border-white/10 text-gray-400')}>
                    Todas las rarezas
                  </button>
                  {availableRarities.map(r => (
                    <button key={r} onClick={() => setFilterRarity(filterRarity === r ? '' : r)}
                      className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all truncate max-w-[120px] ' + (filterRarity === r ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/5 border-white/10 text-gray-400')}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="shrink-0 text-xs text-gray-500">{t.collection.sort}</span>
                {(['recent', 'name', 'value'] as SortOption[]).map(opt => (
                  <button key={opt} onClick={() => setSort(opt)}
                    className={'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ' + (sort === opt ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400')}>
                    {opt === 'recent' ? t.collection.sortRecent : opt === 'name' ? t.collection.sortName : t.collection.sortValue}
                  </button>
                ))}
              </div>
              {cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center"><Layers size={28} className="text-gray-600" /></div>
                  <div>
                    <p className="text-white font-semibold">{t.collection.noCardsYet}</p>
                    <p className="text-sm text-gray-500 mt-1">{t.collection.noCardsYetDesc}</p>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">{t.collection.noMatchesDesc.replace('{search}', search)}</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map(card => (
                    <CollectionCard key={card.id} card={card} onUpdate={(id, update) => updateEntry({ id, update })} onRemove={removeEntry}
                      onEdit={() => setEditingCard(card)} onZoom={() => setZoomedCard(card)}
                      onQR={() => setQrCard(card)} onMarket={() => setMarketCard(card)}
                      formatPrice={formatPrice} t={t} />
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'sets' && (
            <div className="space-y-3">
              {setGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center"><Package size={28} className="text-gray-600" /></div>
                  <p className="text-white font-semibold">Sin sets todavia</p>
                </div>
              ) : setGroups.map(group => {
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
                          {pct > 0 && <span className="text-blue-400 ml-1">{'· ' + pct + '%'}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {pct === 100 && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium block mb-1">Completo</span>}
                        {group.totalValue > 0 && <span className="text-xs text-green-400 font-bold">{formatPrice(group.totalValue)}</span>}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-1.5 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {group.cards.slice(0, 5).map(card => (
                        <img key={card.id} src={card.imageUrl ?? ''} alt={card.cardName ?? ''}
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
                          const setName = encodeURIComponent(group.setName);
                          const url = 'https://api.pokemontcg.io/v2/cards?q=set.name:"' + setName + '"&pageSize=250';
                          const res = await fetch(url);
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
                        className="w-full py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-1.5">
                        <Heart size={12} />
                        {'Anadir ' + missing + ' que faltan a Wishlist'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── COLLECTION CARD ───────────────────────────────────────────
function CollectionCard({ card, onUpdate, onRemove, onEdit, onZoom, onQR, onMarket, formatPrice, t }: {
  card: CollectionItem;
  onUpdate: (id: string, update: Partial<CollectionItem>) => void;
  onRemove: (id: string) => void;
  onEdit: () => void;
  onZoom: () => void;
  onQR: () => void;
  onMarket: () => void;
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
  const sleeveEmoji = SLEEVE_TYPES.find(s => s.key === (card as any).sleeveType)?.emoji;
  const storageLocation = (card as any).storageLocation;
  const purchasePrice = card.purchasePrice;
  const roi = purchasePrice && price ? ((price - purchasePrice) / purchasePrice * 100) : null;
  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      <div className="relative cursor-pointer" onClick={onZoom}>
        <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-full aspect-[2/3] object-cover" loading="lazy" />
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
            <span className="text-[9px] font-bold text-black">{card.gradingCompany + ' ' + card.gradingScore}</span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">{variantEmoji}</span>
          <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">{langFlag}</span>
          {sleeveEmoji && <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">{sleeveEmoji}</span>}
          {card.inBinder && <span className="text-sm bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">📁</span>}
        </div>
      </div>
      <div className="p-2.5 flex-1 space-y-1">
        <p className="text-xs font-bold truncate text-white">{card.cardName}</p>
        <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
        {card.condition && <p className={'text-[10px] font-medium ' + conditionColor}>{getConditionLabel(card.condition as CardCondition, t)}</p>}
        {price && <p className="text-[10px] text-green-400 font-medium">{formatPrice(price)}</p>}
        {roi !== null && (
          <p className={'text-[10px] font-medium ' + (roi >= 0 ? 'text-green-400' : 'text-red-400')}>
            ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
          </p>
        )}
        {storageLocation && (
          <p className="text-[10px] text-blue-400 truncate flex items-center gap-0.5">
            <MapPin size={9} />{storageLocation}
          </p>
        )}
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
          <button onClick={onMarket} className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-green-400"><ShoppingBag size={13} /></button>
          <button onClick={onQR} className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-purple-400"><QrCode size={13} /></button>
          <button onClick={onEdit} className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-blue-400"><Sparkles size={13} /></button>
          <button onClick={handleRemove}
            className={'w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ' + (confirmDelete ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-white/5 text-gray-500')}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
