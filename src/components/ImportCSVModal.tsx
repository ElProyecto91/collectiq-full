import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ParsedCard {
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  cardLanguage: string;
  condition: string | null;
  quantity: number;
  marketPrice: number | null;
  purchasePrice: number | null;
  purchaseSource: string | null;
  acquiredAt: string | null;
  gradingCompany: string | null;
  gradingScore: number | null;
  gradingCertificate: string | null;
  gradeCentering: number | null;
  gradeCorners: number | null;
  gradeEdges: number | null;
  gradeSurface: number | null;
  inSleeve: boolean;
  inBinder: boolean;
  notes: string | null;
}

const VARIANT_MAP: Record<string, string> = {
  'normal': 'normal', 'holofoil': 'holofoil', 'holo': 'holofoil',
  'reverse holo': 'reverseHolofoil', 'reverse holofoil': 'reverseHolofoil',
  '1st edition': 'firstEdition', 'primera edicion': 'firstEdition',
  'promo': 'promo',
};

const LANGUAGE_MAP: Record<string, string> = {
  'ingles': 'en', 'english': 'en', 'en': 'en',
  'espanol': 'es', 'spanish': 'es', 'es': 'es',
  'japones': 'ja', 'japanese': 'ja', 'ja': 'ja',
  'aleman': 'de', 'german': 'de', 'de': 'de',
  'frances': 'fr', 'french': 'fr', 'fr': 'fr',
  'italiano': 'it', 'italian': 'it', 'it': 'it',
  'portugues': 'pt', 'portuguese': 'pt', 'pt': 'pt',
  'coreano': 'ko', 'korean': 'ko', 'ko': 'ko',
};

const CONDITION_MAP: Record<string, string> = {
  'mint': 'mint',
  'near mint': 'near-mint', 'near-mint': 'near-mint', 'nm': 'near-mint',
  'lightly played': 'lightly-played', 'lightly-played': 'lightly-played', 'lp': 'lightly-played',
  'moderately played': 'moderately-played', 'moderately-played': 'moderately-played', 'mp': 'moderately-played',
  'heavily played': 'heavily-played', 'heavily-played': 'heavily-played', 'hp': 'heavily-played',
  'damaged': 'damaged', 'damaged': 'damaged', 'd': 'damaged',
  'poco jugada': 'lightly-played',
  'moderadamente jugada': 'moderately-played',
  'muy jugada': 'heavily-played',
  'danada': 'damaged',
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

  const mappings: Record<string, string[]> = {
    cardName: ['nombre', 'name', 'cardname', 'card', 'carta'],
    setName: ['set', 'expansion', 'setname', 'serie'],
    cardNumber: ['numero', 'number', 'cardnumber', 'num'],
    rarity: ['rareza', 'rarity'],
    variant: ['variante', 'variant', 'finish', 'acabado'],
    cardLanguage: ['idioma', 'language', 'lang'],
    condition: ['condicion', 'condition', 'estado'],
    quantity: ['cantidad', 'quantity', 'qty', 'count'],
    marketPrice: ['preciomercado', 'marketprice', 'price', 'precio', 'value'],
    purchasePrice: ['preciopagado', 'purchaseprice', 'buyprice', 'paid'],
    purchaseSource: ['fuente', 'source', 'purchasesource'],
    acquiredAt: ['fechaadquisicion', 'acquiredat', 'date', 'fecha'],
    gradingCompany: ['grading', 'gradingcompany', 'empresa'],
    gradingScore: ['notagramding', 'gradingscore', 'grade', 'nota'],
    gradingCertificate: ['certificado', 'certificate'],
    inSleeve: ['enfunda', 'insleeve', 'sleeve', 'funda'],
    inBinder: ['enalbum', 'inbinder', 'binder', 'album'],
    notes: ['notas', 'notes', 'comentarios'],
  };

  for (const [key, aliases] of Object.entries(mappings)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some(a => normalized[i].includes(a) || a.includes(normalized[i]))) {
        map[key] = i;
        break;
      }
    }
  }

  return map;
}

function parseRow(cols: string[], colMap: Record<string, number>): ParsedCard | null {
  const get = (key: string) => colMap[key] !== undefined ? (cols[colMap[key]] ?? '').trim() : '';

  const cardName = get('cardName');
  if (!cardName) return null;

  const variantRaw = get('variant').toLowerCase();
  const variant = VARIANT_MAP[variantRaw] ?? 'normal';

  const langRaw = get('cardLanguage').toLowerCase().trim();
  const cardLanguage = LANGUAGE_MAP[langRaw] ?? 'en';

  const condRaw = get('condition').toLowerCase().trim();
  const condition = CONDITION_MAP[condRaw] ?? null;

  const qty = parseInt(get('quantity')) || 1;
  const marketPrice = parseFloat(get('marketPrice')) || null;
  const purchasePrice = parseFloat(get('purchasePrice')) || null;
  const gradingScore = parseFloat(get('gradingScore')) || null;
  const gradeCentering = parseFloat(get('gradeCentering')) || null;
  const gradeCorners = parseFloat(get('gradeCorners')) || null;
  const gradeEdges = parseFloat(get('gradeEdges')) || null;
  const gradeSurface = parseFloat(get('gradeSurface')) || null;

  const inSleeveRaw = get('inSleeve').toLowerCase();
  const inSleeve = inSleeveRaw === 'si' || inSleeveRaw === 'yes' || inSleeveRaw === 'true' || inSleeveRaw === '1';
  const inBinderRaw = get('inBinder').toLowerCase();
  const inBinder = inBinderRaw === 'si' || inBinderRaw === 'yes' || inBinderRaw === 'true' || inBinderRaw === '1';

  const acquiredRaw = get('acquiredAt');
  const acquiredAt = acquiredRaw ? acquiredRaw : null;

  return {
    cardName,
    setName: get('setName'),
    cardNumber: get('cardNumber'),
    rarity: get('rarity') || null,
    variant,
    cardLanguage,
    condition,
    quantity: qty,
    marketPrice,
    purchasePrice,
    purchaseSource: get('purchaseSource') || null,
    acquiredAt,
    gradingCompany: get('gradingCompany') || null,
    gradingScore,
    gradingCertificate: get('gradingCertificate') || null,
    gradeCentering,
    gradeCorners,
    gradeEdges,
    gradeSurface,
    inSleeve,
    inBinder,
    notes: get('notes') || null,
  };
}

export function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'select' | 'preview' | 'importing' | 'done'>('select');
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) return;

      const headers = rows[0];
      const colMap = detectColumns(headers);
      const cards: ParsedCard[] = [];

      for (let i = 1; i < rows.length; i++) {
        const card = parseRow(rows[i], colMap);
        if (card) cards.push(card);
      }

      setParsedCards(cards);
      setPhase('preview');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (!telegramUser?.id || parsedCards.length === 0) return;
    setPhase('importing');

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    const BATCH_SIZE = 20;
    for (let i = 0; i < parsedCards.length; i += BATCH_SIZE) {
      const batch = parsedCards.slice(i, i + BATCH_SIZE);
      const rows = batch.map(card => ({
        telegram_user_id: telegramUser.id,
        tcg: 'pokemon',
        card_id: 'imported-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        card_name: card.cardName,
        set_name: card.setName,
        card_number: card.cardNumber,
        rarity: card.rarity,
        quantity: card.quantity,
        variant: card.variant,
        card_language: card.cardLanguage,
        condition: card.condition,
        market_price: card.marketPrice,
        purchase_price: card.purchasePrice,
        purchase_source: card.purchaseSource,
        acquired_at: card.acquiredAt,
        grading_company: card.gradingCompany,
        grading_score: card.gradingScore,
        grading_certificate: card.gradingCertificate,
        grade_centering: card.gradeCentering,
        grade_corners: card.gradeCorners,
        grade_edges: card.gradeEdges,
        grade_surface: card.gradeSurface,
        in_sleeve: card.inSleeve,
        in_binder: card.inBinder,
        notes: card.notes,
        favorite: false,
        metadata: {},
      }));

      const { error } = await supabase.from('collection_items').insert(rows);
      if (error) {
        skipped += batch.length;
        errors.push('Error en fila ' + (i + 1) + ': ' + error.message);
      } else {
        imported += batch.length;
      }
    }

    setResult({ total: parsedCards.length, imported, skipped, errors });
    setPhase('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Importar coleccion</p>
            <p className="text-xs text-gray-500 mt-0.5">Compatible con CollectIQ, Collectr, pkmn.gg y otros</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {phase === 'select' && (
          <>
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center gap-3 active:scale-95 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                <Upload size={24} className="text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">Selecciona tu archivo CSV</p>
                <p className="text-xs text-gray-500 mt-1">Exportado de CollectIQ, Collectr, pkmn.gg u otras apps</p>
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-400 font-medium">Apps compatibles:</p>
              <div className="flex flex-wrap gap-2">
                {['CollectIQ', 'Collectr', 'pkmn.gg', 'TCG Stacked', 'Excel/Sheets'].map(app => (
                  <span key={app} className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400">
                    {app}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                El importador detecta automaticamente las columnas del CSV.
              </p>
            </div>
          </>
        )}

        {phase === 'preview' && (
          <>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{fileName}</p>
                <p className="text-xs text-green-400">{parsedCards.length} cartas detectadas</p>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-500 font-medium">Vista previa:</p>
              {parsedCards.slice(0, 5).map((card, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{card.cardName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{card.setName} · x{card.quantity}</p>
                  </div>
                  <span className="text-[10px] text-gray-600">{card.variant}</span>
                </div>
              ))}
              {parsedCards.length > 5 && (
                <p className="text-xs text-gray-600 text-center">... y {parsedCards.length - 5} cartas mas</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPhase('select')}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400">
                Cambiar archivo
              </button>
              <button onClick={handleImport}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-sm text-white font-semibold active:scale-95 transition-transform">
                Importar {parsedCards.length} cartas
              </button>
            </div>
          </>
        )}

        {phase === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 size={32} className="text-blue-400 animate-spin" />
            <p className="text-sm text-gray-400">Importando cartas...</p>
          </div>
        )}

        {phase === 'done' && result && (
          <>
            <div className={'rounded-xl p-4 space-y-2 ' + (result.errors.length === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20')}>
              <div className="flex items-center gap-2">
                {result.errors.length === 0
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <AlertCircle size={18} className="text-yellow-400" />
                }
                <p className="text-sm font-bold text-white">
                  {result.errors.length === 0 ? 'Importacion completada' : 'Importacion con errores'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: 'Total', value: result.total, color: 'text-white' },
                  { label: 'Importadas', value: result.imported, color: 'text-green-400' },
                  { label: 'Errores', value: result.skipped, color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="text-center bg-white/5 rounded-xl p-2">
                    <p className={'text-lg font-bold ' + item.color}>{item.value}</p>
                    <p className="text-[10px] text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-red-400">{err}</p>
                ))}
              </div>
            )}

            <button onClick={() => { onSuccess(); onClose(); }}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold active:scale-95 transition-transform">
              Ver mi coleccion
            </button>
          </>
        )}
      </div>
    </div>
  );
}