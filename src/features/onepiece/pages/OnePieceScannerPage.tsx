import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Flashlight, ScanLine, CheckCircle2,
  AlertCircle, Plus, RotateCcw, Loader2, X, ZoomIn,
} from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';

const API      = 'https://collectiq-api.esxdinero.workers.dev';
const GEMINI   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── tipos ──────────────────────────────────────────────────────
interface ScanResult {
  id:         string;
  name:       string;
  number:     string;
  set_id:     string;
  set_name:   string;
  rarity:     string;
  type:       string;
  color:      string[];
  power:      number | null;
  cost:       number | null;
  image_url:  string;
  price_eur:  number | null;
  confidence: number;    // 0-1
  is_onepiece: boolean;
}

// ── colores ────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  Red: '🔴', Blue: '🔵', Green: '🟢',
  Purple: '🟣', Black: '⚫', Yellow: '🟡',
};

// ── helpers ────────────────────────────────────────────────────
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

async function canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise(res => canvas.toBlob(b => blobToBase64(b!).then(res), 'image/jpeg', 0.85));
}

// ── componente ─────────────────────────────────────────────────
export function OnePieceScannerPage() {
  const navigate   = useNavigate();
  const { formatPrice } = useCurrency();
  const { addItem }     = useCollection('onepiece');
  const telegramUser    = useUserStore(s => s.telegramUser);
  const geminiKey       = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''; // usamos la misma var de entorno que ya existe

  // refs
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);

  // estado cámara
  const [cameraReady, setCameraReady]   = useState(false);
  const [cameraError, setCameraError]   = useState('');
  const [torchOn, setTorchOn]           = useState(false);
  const [torchAvailable, setTorchAvail] = useState(false);
  const [zoom, setZoom]                 = useState(1);
  const [zoomAvail, setZoomAvail]       = useState(false);

  // estado escaneo
  const [scanning,  setScanning]   = useState(false);
  const [result,    setResult]     = useState<ScanResult | null>(null);
  const [error,     setScanError]  = useState('');
  const [added,     setAdded]      = useState(false);
  const [scanCount, setScanCount]  = useState(0);

  // ── iniciar cámara ─────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }

      // Comprobar torch y zoom
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() as any;
        setTorchAvail(!!(caps?.torch));
        setZoomAvail(!!(caps?.zoom));
      }
    } catch (e: any) {
      setCameraError('No se pudo acceder a la cámara. Comprueba los permisos.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [startCamera]);

  // ── linterna ───────────────────────────────────────────────
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  };

  // ── tap-to-focus ──────────────────────────────────────────
  const handleTapFocus = async (e: React.TouchEvent<HTMLDivElement>) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !videoRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top)  / rect.height;
    try {
      await (track as any).applyConstraints({
        advanced: [{ pointOfInterest: { x, y }, focusMode: 'single-shot' }]
      });
    } catch {}
    // Animación visual de foco
    if (overlayRef.current) {
      const dot = document.createElement('div');
      dot.className = 'focus-dot';
      dot.style.cssText = `
        position:absolute; width:48px; height:48px;
        border:2px solid #ef4444; border-radius:50%;
        left:${touch.clientX - rect.left - 24}px;
        top:${touch.clientY - rect.top - 24}px;
        pointer-events:none; animation: focusFade 0.8s ease forwards;
      `;
      overlayRef.current.appendChild(dot);
      setTimeout(() => dot.remove(), 800);
    }
  };

  // ── zoom ──────────────────────────────────────────────────
  const applyZoom = async (val: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ zoom: val }] });
      setZoom(val);
    } catch {}
  };

  // ── capturar frame ────────────────────────────────────────
  const captureFrame = (): string | null => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    // Recortar zona central (carta) para reducir ruido
    const cx = canvas.width  * 0.1;
    const cy = canvas.height * 0.1;
    const cw = canvas.width  * 0.8;
    const ch = canvas.height * 0.8;
    const crop = document.createElement('canvas');
    crop.width  = cw;
    crop.height = ch;
    crop.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return crop.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  // ── validar contra optcgapi ───────────────────────────────
  const validateAgainstCatalog = async (name: string, number: string, setId: string): Promise<ScanResult | null> => {
    const params = new URLSearchParams({ page: '1', limit: '5' });
    if (number) params.set('q', number);
    else if (name) params.set('q', name.toLowerCase());
    if (setId) params.set('set', setId.toUpperCase());
    try {
      const r = await fetch(`${API}/onepiece-cards?${params}`);
      if (!r.ok) return null;
      const d = await r.json();
      const cards: ScanResult[] = d.cards || [];
      // Buscar coincidencia exacta por número primero
      const byNumber = cards.find(c => c.number?.toUpperCase() === number?.toUpperCase());
      return byNumber || cards[0] || null;
    } catch { return null; }
  };

  // ── escanear ──────────────────────────────────────────────
  const scan = async () => {
    if (scanning) return;
    const b64 = captureFrame();
    if (!b64) { setScanError('No se pudo capturar imagen'); return; }

    setScanning(true);
    setScanError('');
    setResult(null);
    setAdded(false);

    try {
      // 1️⃣ Gemini identifica la carta
      const geminiRes = await fetch(
        `${GEMINI}?key=${import.meta.env.VITE_GEMINI_API_KEY ?? geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Eres un experto en One Piece TCG. Analiza esta imagen y devuelve SOLO JSON con estos campos:
{
  "is_onepiece_card": boolean,
  "name": "nombre de la carta en inglés",
  "number": "código de carta ej OP01-077",
  "set_id": "código del set ej OP01",
  "rarity": "Common|Uncommon|Rare|Super Rare|Secret Rare|Leader|Promo",
  "type": "Character|Event|Stage|Leader|DON!!",
  "color": ["Red","Blue","Green","Purple","Black","Yellow"],
  "cost": número o null,
  "power": número o null,
  "confidence": 0.0-1.0
}
Solo JSON, sin texto adicional.`,
                },
                { inline_data: { mime_type: 'image/jpeg', data: b64 } }
              ]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 512 }
          })
        }
      );

      const geminiData = await geminiRes.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      let parsed: any = {};
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch {
        throw new Error('No se pudo leer la respuesta de IA');
      }

      if (!parsed.is_onepiece_card) {
        setScanError('No parece una carta de One Piece TCG. Inténtalo con mejor iluminación.');
        setScanning(false);
        return;
      }

      // 2️⃣ Validar contra catálogo real
      const validated = await validateAgainstCatalog(
        parsed.name   || '',
        parsed.number || '',
        parsed.set_id || ''
      );

      if (validated) {
        setResult({
          ...validated,
          // Mezclar datos de Gemini que el catálogo puede no tener
          confidence: parsed.confidence ?? 0.8,
          is_onepiece: true,
        });
      } else {
        // Usar datos de Gemini sin validación (confianza baja)
        setResult({
          id:          parsed.number || '',
          name:        parsed.name   || 'Carta desconocida',
          number:      parsed.number || '',
          set_id:      parsed.set_id || '',
          set_name:    parsed.set_id || '',
          rarity:      parsed.rarity || '',
          type:        parsed.type   || '',
          color:       Array.isArray(parsed.color) ? parsed.color : [],
          power:       parsed.power  ?? null,
          cost:        parsed.cost   ?? null,
          image_url:   '',
          price_eur:   null,
          confidence:  parsed.confidence ?? 0.4,
          is_onepiece: true,
        });
      }

      setScanCount(c => c + 1);
    } catch (e: any) {
      setScanError(e.message || 'Error al escanear');
    } finally {
      setScanning(false);
    }
  };

  // ── añadir a colección ────────────────────────────────────
  const handleAdd = () => {
    if (!result || !telegramUser?.id) return;
    addItem({
      card_id:    result.id,
      tcg:        'onepiece',
      card_name:  result.name,
      set_name:   result.set_name,
      card_number: result.number,
      rarity:     result.rarity,
      image_url:  result.image_url,
      quantity:   1,
      favorite:   false,
      market_price: result.price_eur ?? null,
      currency:   'EUR',
    } as any);
    setAdded(true);
    setTimeout(() => { setResult(null); setAdded(false); }, 2000);
  };

  // ── render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <style>{`
        @keyframes focusFade {
          0%   { opacity:1; transform:scale(1); }
          100% { opacity:0; transform:scale(1.6); }
        }
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 85%; }
          100% { top: 10%; }
        }
        .scan-line { animation: scanLine 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-6 pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/onepiece')}
            className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Escáner</h1>
          </div>
          {scanCount > 0 && (
            <span className="ml-auto text-[10px] text-gray-400">
              {scanCount} escaneada{scanCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Vista de cámara */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay tap-to-focus */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          onTouchStart={handleTapFocus}
        />

        {/* Marco de escaneo */}
        {cameraReady && !result && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Oscurecer bordes */}
            <div className="absolute inset-0 bg-black/40" style={{
              WebkitMaskImage: 'radial-gradient(ellipse 60% 75% at 50% 50%, transparent 100%, black 100%)',
              maskImage: 'radial-gradient(ellipse 60% 75% at 50% 50%, transparent 100%, black 100%)',
            }} />
            {/* Marco */}
            <div className="relative w-64 h-80 border-2 border-red-500/70 rounded-2xl overflow-hidden">
              {/* Esquinas decorativas */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-6 h-6 border-red-400 ${cls}`} />
              ))}
              {/* Línea de escaneo */}
              <div className="scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent pointer-events-none" />
            </div>
            <p className="absolute bottom-[22%] text-xs text-white/70 text-center px-8">
              Coloca la carta dentro del marco · Toca para enfocar
            </p>
          </div>
        )}

        {/* Controles superpuestos (linterna, zoom) */}
        {cameraReady && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
            {torchAvailable && (
              <button onClick={toggleTorch}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${torchOn ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-400' : 'bg-black/40 border-white/20 text-white/60'}`}>
                <Flashlight size={18} />
              </button>
            )}
            {zoomAvail && (
              <div className="flex flex-col gap-1">
                {[1, 1.5, 2].map(z => (
                  <button key={z} onClick={() => applyZoom(z)}
                    className={`w-11 h-8 rounded-xl border text-[10px] font-bold transition-all ${zoom === z ? 'bg-red-600/40 border-red-500/50 text-red-300' : 'bg-black/40 border-white/20 text-white/60'}`}>
                    {z}×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error de cámara */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm text-gray-300">{cameraError}</p>
            <button onClick={startCamera}
              className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2">
              <RotateCcw size={16} /> Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Panel inferior */}
      <div className="bg-[#0a0a0f] border-t border-white/8 px-4 pt-4 pb-8 space-y-4 z-10">

        {/* Error de escaneo */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
            <button onClick={() => setScanError('')} className="ml-auto text-gray-500">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Resultado */}
        {result && !added && (
          <div className="bg-[#111118] border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex gap-3 p-3">
              {result.image_url ? (
                <img src={result.image_url} alt={result.name}
                  className="w-16 h-22 object-cover rounded-xl shrink-0"
                  style={{ height: '5.5rem' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 rounded-xl bg-white/5 flex items-center justify-center shrink-0" style={{ height: '5.5rem' }}>
                  <span className="text-2xl">☠️</span>
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-bold leading-tight">{result.name}</p>
                <p className="text-[10px] text-gray-500">{result.number} · {result.set_name || result.set_id}</p>
                {result.rarity && (
                  <p className="text-[10px] text-yellow-400">{result.rarity}</p>
                )}
                <div className="flex gap-1 flex-wrap">
                  {result.color.map(c => (
                    <span key={c} className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded-full">
                      {COLOR_MAP[c] ?? '⚪'} {c}
                    </span>
                  ))}
                </div>
                {result.cost != null && (
                  <span className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded-full inline-block">⚡ {result.cost}</span>
                )}
                {result.power != null && (
                  <span className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded-full inline-block ml-1">💪 {result.power.toLocaleString()}</span>
                )}
                {result.price_eur != null && (
                  <p className="text-xs font-bold text-green-400">{formatPrice(result.price_eur)}</p>
                )}
                {/* Confianza */}
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 bg-white/8 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${result.confidence >= 0.8 ? 'bg-green-500' : result.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.round(result.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-500">{Math.round(result.confidence * 100)}%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <button onClick={() => { setResult(null); setScanError(''); }}
                clas