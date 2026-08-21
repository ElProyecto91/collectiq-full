import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, ScanLine, Search, Loader2, AlertCircle, CheckCircle2, Plus, Sparkles } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/use-analytics';

interface FunkoResult {
  id?: string;
  name: string;
  character?: string;
  franchise?: string;
  series?: string;
  number?: string;
  image_url?: string;
  is_chase?: boolean;
  exclusivity?: string;
  estimated_value?: number;
}

type ScanMode = 'barcode' | 'ai';
type ScanPhase = 'idle' | 'scanning' | 'analyzing' | 'results' | 'no-results' | 'error';

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function searchFunkoByUPC(upc: string): Promise<FunkoResult[]> {
  const { data } = await supabase
    .from('funko_items')
    .select('*')
    .eq('upc', upc)
    .limit(5);
  return data ?? [];
}

async function searchFunkoByName(name: string): Promise<FunkoResult[]> {
  const { data } = await supabase
    .from('funko_items')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(10);
  return data ?? [];
}

async function identifyFunkoWithAI(base64: string): Promise<{ name: string; franchise?: string; number?: string; confidence: number; is_funko?: boolean }> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY ?? '';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are a Funko Pop expert. Analyze this image and identify the Funko Pop figure.
Return ONLY a JSON object with:
- "name": the character name (e.g. "Iron Man", "Pikachu", "Darth Vader")
- "franchise": the franchise/series (e.g. "Marvel", "Pokemon", "Star Wars")
- "number": the Funko Pop number if visible (e.g. "126")
- "confidence": 0-100 confidence score
- "is_funko": true or false

Return ONLY the JSON, no markdown, no explanation.`
            },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 128 },
      }),
    }
  );
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { name: '', confidence: 0 };
  }
}

export function FunkoScannerPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { track } = useAnalytics();

  const [mode, setMode] = useState<ScanMode>('barcode');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<FunkoResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [aiConfidence, setAiConfidence] = useState(0);

  const reset = () => {
    setPhase('idle');
    setPreviewUrl(null);
    setResults([]);
    setErrorMsg('');
    setStatusMsg('');
    setSearchQuery('');
    setAiConfidence(0);
  };

  const handleBarcodeInput = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    setPhase('analyzing');
    setStatusMsg('Buscando Funko por código...');
    track('funko_scan_started', { mode: 'barcode' });
    try {
      const found = await searchFunkoByUPC(barcode.trim());
      setResults(found);
      setPhase(found.length === 0 ? 'no-results' : 'results');
      track(found.length === 0 ? 'funko_scan_no_results' : 'funko_scan_success', { mode: 'barcode' });
    } catch {
      setErrorMsg('Error al buscar el Funko. Inténtalo de nuevo.');
      setPhase('error');
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhase('analyzing');
    setStatusMsg('Analizando imagen con IA...');
    track('funko_scan_started', { mode: 'ai' });
    try {
      const base64 = await toBase64(file);
      const aiResult = await identifyFunkoWithAI(base64);
      if (!aiResult.is_funko || !aiResult.name) {
        setPhase('no-results');
        return;
      }
      setAiConfidence(aiResult.confidence ?? 0);
      setStatusMsg(`Buscando "${aiResult.name}"...`);
      const found = await searchFunkoByName(aiResult.name);
      setResults(found);
      setSearchQuery(aiResult.name);
      setPhase(found.length === 0 ? 'no-results' : 'results');
      track(found.length === 0 ? 'funko_scan_no_results' : 'funko_scan_success', { mode: 'ai', confidence: aiResult.confidence });
    } catch {
      setErrorMsg('Error al analizar la imagen. Inténtalo de nuevo.');
      setPhase('error');
      track('funko_scan_failed', { mode: 'ai' });
    }
    e.target.value = '';
  }, []);

  const manualSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPhase('analyzing');
    setStatusMsg(`Buscando "${searchQuery}"...`);
    try {
      const found = await searchFunkoByName(searchQuery.trim());
      setResults(found);
      setPhase(found.length === 0 ? 'no-results' : 'results');
    } catch {
      setErrorMsg('Error al buscar. Inténtalo de nuevo.');
      setPhase('error');
    }
  }, [searchQuery]);

  const addToCollection = async (funko: FunkoResult) => {
    if (!telegramUser?.id) return;
    const { data } = await supabase.from('funko_collection').insert({
      telegram_user_id: telegramUser.id,
      funko_id: funko.id ?? null,
      custom_name: funko.id ? null : funko.name,
      quantity: 1,
      condition: 'mint',
      box_condition: 'mint',
      currency: 'EUR',
    }).select().single();
    if (data) {
      setAddedIds(prev => new Set(prev).add(funko.id ?? funko.name));
      setStatusMsg(`✅ ${funko.name} añadido a tu colección`);
      setTimeout(() => setStatusMsg(''), 3000);
      track('funko_added', { name: funko.name, franchise: funko.franchise });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/40 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate(RoutePaths.FunkoHome)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
            <h1 className="text-lg font-bold leading-tight">Escanear Funko</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-4">

        {/* Selector de modo */}
        <div className="flex gap-2">
          <button onClick={() => { setMode('barcode'); reset(); }}
            className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ' + (mode === 'barcode' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400')}>
            📦 Código de barras
          </button>
          <button onClick={() => { setMode('ai'); reset(); }}
            className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ' + (mode === 'ai' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400')}>
            ✨ IA
          </button>
        </div>

        {/* Modo barcode */}
        {mode === 'barcode' && phase === 'idle' && (
          <div className="space-y-3">
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-white">📦 Escanear código de barras</p>
              <p className="text-xs text-gray-400">Introduce el código UPC de la caja del Funko manualmente o usa un lector externo.</p>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  placeholder="Introduce el código UPC..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeInput((e.target as HTMLInputElement).value)}
                />
                <button onClick={() => handleBarcodeInput(barcodeInputRef.current?.value ?? '')}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold active:scale-95">
                  Buscar
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-gray-600">Si tienes un lector de códigos Bluetooth, conéctalo y escanea directamente</p>
          </div>
        )}

        {/* Modo IA */}
        {mode === 'ai' && phase === 'idle' && (
          <div className="space-y-3">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden bg-[#111118] border border-white/10" style={{ aspectRatio: '3/4' }}>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Camera className="w-5 h-5" />
              Fotografiar Funko
            </button>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-purple-300">💡 Consejos para mejor resultado</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>• Fotografía la parte frontal de la caja</p>
                <p>• Asegúrate de que el nombre sea legible</p>
                <p>• Buena iluminación sin reflejos</p>
              </div>
            </div>
          </div>
        )}

        {/* Analizando */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <p className="text-sm text-purple-200 text-center">{statusMsg}</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{errorMsg}</p>
              <button onClick={reset} className="mt-2 text-xs text-red-400 underline">Volver a intentar</button>
            </div>
          </div>
        )}

        {/* Sin resultados */}
        {phase === 'no-results' && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <p className="text-sm text-yellow-300 font-medium">No encontramos este Funko</p>
              <p className="text-xs text-yellow-400/70 mt-1">Prueba a buscarlo por nombre manualmente.</p>
            </div>
            <div className="flex gap-2">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && manualSearch()}
                placeholder="Nombre del Funko..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50" />
              <button onClick={manualSearch}
                className="bg-purple-600 rounded-xl px-4 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Buscador manual siempre visible en resultados */}
        {phase === 'results' && (
          <div className="flex gap-2">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && manualSearch()}
              placeholder="Buscar otro Funko..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50" />
            <button onClick={manualSearch}
              className="bg-purple-600 rounded-xl px-4 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Confianza IA */}
        {phase === 'results' && aiConfidence > 0 && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300">Identificación IA: <strong className="text-white">{aiConfidence}%</strong></span>
          </div>
        )}

        {/* Resultados */}
        {phase === 'results' && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
            {results.map((funko, i) => {
              const key = funko.id ?? funko.name;
              const added = addedIds.has(key);
              return (
                <div key={i} className="bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    {funko.image_url
                      ? <img src={funko.image_url} alt={funko.name} className="w-full h-full object-contain rounded-xl" />
                      : <span className="text-2xl">🎭</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{funko.name}</p>
                    {funko.franchise && <p className="text-xs text-gray-500 truncate">{funko.franchise}</p>}
                    {funko.number && <p className="text-xs text-purple-400">#{funko.number}</p>}
                    {funko.is_chase && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-bold">CHASE</span>}
                    {funko.estimated_value && <p className="text-xs text-green-400 font-medium mt-0.5">€{funko.estimated_value.toFixed(2)}</p>}
                  </div>
                  <button onClick={() => addToCollection(funko)} disabled={added}
                    className={'rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 ' + (added ? 'bg-green-500/20 text-green-400' : 'bg-purple-600 text-white')}>
                    {added ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {statusMsg && phase !== 'analyzing' && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl px-4 py-3 text-sm text-purple-300 text-center">{statusMsg}</div>
        )}

      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
    </div>
  );
}