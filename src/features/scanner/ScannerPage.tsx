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
  Type,
  Plus,
  Cpu,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { RoutePaths } from '@/config';
import { useI18n } from '@/i18n';
import { cx } from '@/utils';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string };
}

type ScanPhase = 'idle' | 'preview' | 'analyzing' | 'results' | 'error';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function identifyCardWithAI(base64Image: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing Anthropic API key');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            {
              type: 'text',
              text: 'This is a Pokemon trading card. Return ONLY the exact Pokemon name printed on the card, nothing else. No punctuation, no explanation.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim() ?? '';
  if (!text) throw new Error('No card name returned');
  return text;
}

async function searchPokemonTCG(name: string): Promise<PokemonCard[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(name)}"&pageSize=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('PokéTCG API error');
  const json = await res.json();
  return (json.data ?? []) as PokemonCard[];
}

function saveToCollection(card: PokemonCard) {
  const raw = localStorage.getItem('pokemon-collection');
  const collection: PokemonCard[] = raw ? JSON.parse(raw) : [];
  if (!collection.find((c) => c.id === card.id)) {
    collection.push(card);
    localStorage.setItem('pokemon-collection', JSON.stringify(collection));
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */
export default function ScannerPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [detectedName, setDetectedName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState('');

  /* ---- file handling ---- */
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const b64 = await toBase64(file);
      setBase64Image(b64);
      setPhase('preview');
      setResults([]);
      setDetectedName('');
      setSearchQuery('');
      setErrorMsg('');
    } catch {
      setErrorMsg('Error reading image');
      setPhase('error');
    }

    // reset input so same file can be selected again
    e.target.value = '';
  }, []);

  /* ---- open camera ---- */
  const openCamera = () => fileInputRef.current?.click();

  /* ---- analyze ---- */
  const analyzeCard = useCallback(async () => {
    if (!base64Image) return;
    setPhase('analyzing');
    setStatusMsg('Identificando carta con IA…');

    try {
      const name = await identifyCardWithAI(base64Image);
      setDetectedName(name);
      setSearchQuery(name);
      setStatusMsg(`Buscando "${name}" en PokéTCG…`);

      const cards = await searchPokemonTCG(name);
      setResults(cards);
      setPhase('results');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error analyzing card');
      setPhase('error');
    }
  }, [base64Image]);

  /* ---- manual search ---- */
  const manualSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPhase('analyzing');
    setStatusMsg(`Buscando "${searchQuery}"…`);
    try {
      const cards = await searchPokemonTCG(searchQuery.trim());
      setResults(cards);
      setPhase('results');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Search error');
      setPhase('error');
    }
  }, [searchQuery]);

  /* ---- add to collection ---- */
  const addCard = (card: PokemonCard) => {
    saveToCollection(card);
    setAddedIds((prev) => new Set(prev).add(card.id));
    setStatusMsg(`✅ ${card.name} añadida a tu colección`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  /* ---- reset ---- */
  const reset = () => {
    setPhase('idle');
    setPreviewUrl(null);
    setBase64Image(null);
    setDetectedName('');
    setSearchQuery('');
    setResults([]);
    setErrorMsg('');
    setStatusMsg('');
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white pb-24">
      <PageHeader
        title={t('scanner.title')}
        subtitle="ESCÁNER"
        leftAction={
          <button onClick={() => navigate(RoutePaths.HOME)} className="p-2 rounded-lg hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />

      <div className="flex-1 px-4 pt-4 space-y-4">

        {/* ---- Scanner frame ---- */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-[3/4] flex items-center justify-center border border-gray-800">
          {previewUrl ? (
            <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <ScanLine className="w-12 h-12" />
              <p className="text-sm">La vista de la cámara aparecerá aquí</p>
            </div>
          )}

          {/* Corner guides */}
          {(['tl','tr','bl','br'] as const).map((corner) => (
            <span
              key={corner}
              className={cx(
                'absolute w-6 h-6 border-blue-400',
                corner === 'tl' && 'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
                corner === 'tr' && 'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
                corner === 'bl' && 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
                corner === 'br' && 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
              )}
            />
          ))}

          {/* Analyzing overlay */}
          {phase === 'analyzing' && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
              <Cpu className="w-10 h-10 text-blue-400 animate-pulse" />
              <p className="text-sm text-blue-200 text-center px-4">{statusMsg}</p>
            </div>
          )}
        </div>

        {/* ---- Tip ---- */}
        {phase === 'idle' && (
          <p className="text-center text-xs text-gray-500">
            Para mejores resultados, fotografía una sola carta con buena luz y sin reflejos.
          </p>
        )}

        {/* ---- Status toast ---- */}
        {statusMsg && phase !== 'analyzing' && (
          <div className="bg-blue-900/50 border border-blue-700 rounded-xl px-4 py-3 text-sm text-blue-200 text-center">
            {statusMsg}
          </div>
        )}

        {/* ---- Error ---- */}
        {phase === 'error' && (
          <Card className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-200">{errorMsg}</p>
              <button onClick={reset} className="mt-2 text-xs text-red-400 underline">Volver a intentar</button>
            </div>
          </Card>
        )}

        {/* ---- Search box (shown after preview or results) ---- */}
        {(phase === 'preview' || phase === 'results') && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualSearch()}
                placeholder="Nombre de la carta…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={manualSearch}
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 flex items-center justify-center hover:bg-gray-700"
            >
              <Search className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        )}

        {/* ---- Detected name badge ---- */}
        {detectedName && phase === 'results' && (
          <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-800 rounded-xl px-3 py-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-300">IA detectó: <strong>{detectedName}</strong></span>
          </div>
        )}

        {/* ---- Results grid ---- */}
        {phase === 'results' && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No se encontraron cartas. Prueba editando el nombre.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {results.map((card) => (
                  <Card key={card.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" />
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-semibold truncate">{card.name}</p>
                      <p className="text-xs text-gray-400 truncate">{card.set.name}</p>
                      {card.rarity && <p className="text-xs text-yellow-500 truncate">{card.rarity}</p>}
                      <button
                        onClick={() => addCard(card)}
                        disabled={addedIds.has(card.id)}
                        className={cx(
                          'w-full mt-1 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors',
                          addedIds.has(card.id)
                            ? 'bg-green-800 text-green-300 cursor-default'
                            : 'bg-blue-600 hover:bg-blue-500 text-white',
                        )}
                      >
                        {addedIds.has(card.id) ? (
                          <><CheckCircle2 className="w-3 h-3" /> Añadida</>
                        ) : (
                          <><Plus className="w-3 h-3" /> Añadir</>
                        )}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- Action buttons ---- */}
        <div className="space-y-3 pt-2">
          {phase === 'idle' && (
            <Button size="md" fullWidth onClick={openCamera} className="bg-blue-600 hover:bg-blue-500 rounded-2xl py-4">
              <Camera className="w-5 h-5 mr-2" />
              Escanear carta
            </Button>
          )}

          {phase === 'preview' && (
            <div className="flex gap-3">
              <Button size="md" fullWidth onClick={analyzeCard} className="bg-blue-600 hover:bg-blue-500 rounded-2xl">
                <Sparkles className="w-4 h-4 mr-2" />
                Analizar con IA
              </Button>
              <Button size="md" variant="outline" onClick={openCamera} className="rounded-2xl px-4">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {phase === 'results' && (
            <div className="flex gap-3">
              <Button size="md" fullWidth onClick={openCamera} className="bg-blue-600 hover:bg-blue-500 rounded-2xl">
                <Camera className="w-4 h-4 mr-2" />
                Escanear otra
              </Button>
              <Button size="md" variant="outline" onClick={reset} className="rounded-2xl px-4">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {phase === 'error' && (
            <Button size="md" fullWidth onClick={openCamera} className="bg-blue-600 hover:bg-blue-500 rounded-2xl">
              <Camera className="w-4 h-4 mr-2" />
              Intentar de nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}