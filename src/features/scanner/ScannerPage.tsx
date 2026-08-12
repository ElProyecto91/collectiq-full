import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  ScanLine,
  RefreshCw,
  Sparkles,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
}

type ScanPhase = 'idle' | 'preview' | 'analyzing' | 'results' | 'error';

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractCardName(fullText: string): string {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const skipPrefixes = [
    'FASE', 'FASE2', 'FASE 2', 'BASIC', 'STAGE', 'LEVEL', 'ITEM',
    'TRAINER', 'ENERGY', 'HP', 'PS', 'GX', 'EX', 'BASICO', 'BÁSICO',
    'HOLOGRAPHIC', 'POKEMON', 'POKÉMON', 'SUPPORTER', 'TOOL',
    'VMAX', 'VSTAR', 'TAG', 'TEAM',
  ];

  for (const line of lines.slice(0, 8)) {
    let cleaned = line.replace(/[^a-zA-ZÀ-ÿ\s\-]/g, '').trim();
    for (const prefix of skipPrefixes) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      cleaned = cleaned.replace(regex, '').trim();
    }
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 25 &&
      !skipPrefixes.some(s => cleaned.toUpperCase().trim() === s.trim()) &&
      !cleaned.match(/^\d+$/) &&
      /[a-zA-Z]/.test(cleaned)
    ) {
      return cleaned;
    }
  }
  return lines[0]?.replace(/[^a-zA-ZÀ-ÿ\s\-]/g, '').trim() ?? '';
}

async function extractCardNameWithVision(base64: string): Promise<string> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? `Vision error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error('No se detectó texto en la imagen');
  return extractCardName(data.text);
}

// Search with automatic retry
async function searchPokemonTCG(name: string, retries = 3): Promise<PokemonCard[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(name)}"&pageSize=20&orderBy=-set.releaseDate`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`PokéTCG error: ${res.status}`);
      const json = await res.json();
      return (json.data ?? []) as PokemonCard[];
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  return [];
}

interface CollectionEntry {
  card: PokemonCard;
  quantity: number;
  favorite: boolean;
  addedAt: number;
}

function saveToCollection(card: PokemonCard) {
  const raw = localStorage.getItem('pokemon-collection');
  let collection: CollectionEntry[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && !('card' in parsed[0])) {
          collection = parsed.map((c: PokemonCard) => ({
            card: c, quantity: 1, favorite: false, addedAt: Date.now(),
          }));
        } else {
          collection = parsed;
        }
      }
    } catch { collection = []; }
  }
  if (!collection.find((e) => e.card.id === card.id)) {
    collection.push({ card, quantity: 1, favorite: false, addedAt: Date.now() });
    localStorage.setItem('pokemon-collection', JSON.stringify(collection));
  }
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-400';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-300';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-400';
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [detectedName, setDetectedName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCurrentFile(file);
    setPhase('preview');
    setResults([]);
    setDetectedName('');
    setSearchQuery('');
    setErrorMsg('');
    setStatusMsg('');
    e.target.value = '';
  }, []);

  const openCamera = () => fileInputRef.current?.click();

  const analyzeCard = useCallback(async () => {
    if (!currentFile) return;
    setPhase('analyzing');
    setProgress(20);
    setStatusMsg('Enviando imagen a Google Vision…');

    try {
      const base64 = await toBase64(currentFile);
      setProgress(50);
      setStatusMsg('Leyendo texto de la carta…');

      const name = await extractCardNameWithVision(base64);
      setProgress(70);

      if (!name) {
        setStatusMsg('No se detectó nombre. Escríbelo manualmente.');
        setPhase('preview');
        return;
      }

      setDetectedName(name);
      setSearchQuery(name);
      setStatusMsg(`Buscando "${name}"…`);
      setProgress(85);

      const cards = await searchPokemonTCG(name);
      setProgress(100);
      setResults(cards);
      setPhase('results');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error al analizar la carta');
      setPhase('error');
    }
  }, [currentFile]);

  const manualSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPhase('analyzing');
    setProgress(50);
    setStatusMsg(`Buscando "${searchQuery}"…`);
    try {
      const cards = await searchPokemonTCG(searchQuery.trim());
      setProgress(100);
      setResults(cards);
      setPhase('results');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error de búsqueda');
      setPhase('error');
    }
  }, [searchQuery]);

  const addCard = (card: PokemonCard) => {
    saveToCollection(card);
    setAddedIds((prev) => new Set(prev).add(card.id));
    setStatusMsg(`✅ ${card.name} añadida a tu colección`);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const reset = () => {
    setPhase('idle');
    setPreviewUrl(null);
    setCurrentFile(null);
    setDetectedName('');
    setSearchQuery('');
    setResults([]);
    setErrorMsg('');
    setStatusMsg('');
    setProgress(0);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">

      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => navigate(RoutePaths.Home)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
            <h1 className="text-lg font-bold leading-tight">Escanear carta</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-4">

        {/* Scanner frame */}
        <div className="relative rounded-2xl overflow-hidden bg-[#111118] border border-white/10" style={{ aspectRatio: '3/4' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30" />
                <ScanLine className="absolute inset-0 m-auto w-10 h-10 text-blue-400/60" />
              </div>
              <p className="text-sm text-gray-500 text-center px-8">Apunta la cámara a una carta</p>
            </div>
          )}

          {(['tl','tr','bl','br'] as const).map((c) => (
            <span key={c} className={cx(
              'absolute w-5 h-5 border-blue-400',
              c === 'tl' && 'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
              c === 'tr' && 'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
              c === 'bl' && 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
              c === 'br' && 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
            )} />
          ))}

          {phase === 'analyzing' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-sm text-blue-200 text-center">{statusMsg}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {statusMsg && phase !== 'analyzing' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{errorMsg}</p>
              <button onClick={reset} className="mt-2 text-xs text-red-400 underline">Volver a intentar</button>
            </div>
          </div>
        )}

        {(phase === 'preview' || phase === 'results') && (
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && manualSearch()}
              placeholder="Nombre de la carta…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <button onClick={manualSearch} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 flex items-center justify-center transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {detectedName && phase === 'results' && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300">Detectado: <strong className="text-white">{detectedName}</strong></span>
          </div>
        )}

        {phase === 'results' && (
          results.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No se encontraron cartas. Prueba editando el nombre.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-2 gap-3">
                {results.map((card) => (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="relative">
                      <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" />
                      {addedIds.has(card.id) && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                      {card.rarity && (
                        <p className={cx('text-[10px] truncate font-medium', getRarityColor(card.rarity))}>{card.rarity}</p>
                      )}
                      {card.cardmarket?.prices?.averageSellPrice && (
                        <p className="text-[10px] text-green-400 font-medium">€{card.cardmarket.prices.averageSellPrice.toFixed(2)}</p>
                      )}
                      <button
                        onClick={() => addCard(card)}
                        disabled={addedIds.has(card.id)}
                        className={cx(
                          'w-full mt-1 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          addedIds.has(card.id) ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95',
                        )}
                      >
                        {addedIds.has(card.id) ? <><CheckCircle2 className="w-3 h-3" /> Añadida</> : <><Plus className="w-3 h-3" /> Añadir</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}

        <div className="space-y-3 pt-2">
          {phase === 'idle' && (
            <button onClick={openCamera} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform">
              <Camera className="w-5 h-5" />
              Escanear carta
            </button>
          )}
          {phase === 'preview' && (
            <div className="flex gap-3">
              <button onClick={analyzeCard} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform">
                <Sparkles className="w-4 h-4" />
                Identificar carta
              </button>
              <button onClick={openCamera} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {phase === 'results' && (
            <div className="flex gap-3">
              <button onClick={openCamera} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Camera className="w-4 h-4" />
                Escanear otra
              </button>
              <button onClick={reset} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {phase === 'error' && (
            <button onClick={openCamera} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Camera className="w-4 h-4" />
              Intentar de nuevo
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <p className="text-center text-[11px] text-gray-600 pb-2">
            Fotografía la carta con buena luz · Sin reflejos · Una sola carta
          </p>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
    </div>
  );
}