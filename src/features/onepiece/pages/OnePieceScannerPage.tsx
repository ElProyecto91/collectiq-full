import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScanLine, CheckCircle2,
  AlertCircle, Plus, RotateCcw, Loader2, X,
} from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';

const API = 'https://collectiq-api.esxdinero.workers.dev';

interface ScanResult {
  id: string;
  name: string;
  number: string;
  set_id: string;
  set_name: string;
  rarity: string;
  type: string;
  color: string[];
  power: number | null;
  cost: number | null;
  image_url: string;
  price_eur: number | null;
  confidence: number;
}

const COLOR_MAP: Record<string, string> = {
  Red: '🔴', Blue: '🔵', Green: '🟢',
  Purple: '🟣', Black: '⚫', Yellow: '🟡',
};

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

export function OnePieceScannerPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addItem } = useCollection('onepiece');
  const telegramUser = useUserStore(s => s.telegramUser);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvail] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [added, setAdded] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() as any;
        setTorchAvail(!!(caps?.torch));
      }
    } catch {
      setCameraError('No se pudo acceder a la cámara. Comprueba los permisos.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [startCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  };

  const handleTapFocus = async (e: React.TouchEvent<HTMLDivElement>) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !videoRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    try {
      await (track as any).applyConstraints({
        advanced: [{ pointOfInterest: { x, y }, focusMode: 'single-shot' }]
      });
    } catch {}
    if (overlayRef.current) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:absolute;width:48px;height:48px;
        border:2px solid #ef4444;border-radius:50%;
        left:${touch.clientX - rect.left - 24}px;
        top:${touch.clientY - rect.top - 24}px;
        pointer-events:none;animation:focusFade 0.8s ease forwards;
      `;
      overlayRef.current.appendChild(dot);
      setTimeout(() => dot.remove(), 800);
    }
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const cx = canvas.width * 0.1;
    const cy = canvas.height * 0.1;
    const cw = canvas.width * 0.8;
    const ch = canvas.height * 0.8;
    const crop = document.createElement('canvas');
    crop.width = cw;
    crop.height = ch;
    crop.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return crop.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

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
      const byNumber = cards.find(c => c.number?.toUpperCase() === number?.toUpperCase());
      return byNumber || cards[0] || null;
    } catch { return null; }
  };

  const scan = async () => {
    if (scanning) return;
    const b64 = captureFrame();
    if (!b64) { setScanError('No se pudo capturar imagen'); return; }
    setScanning(true);
    setScanError('');
    setResult(null);
    setAdded(false);
    try {
      // Escanear via Worker — tiene GEMINI_API_KEY, no expone clave en frontend
      const scanRes = await fetch(`${API}/onepiece-scanner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      if (!scanRes.ok) throw new Error('Error al conectar con el servidor');
      const scanData = await scanRes.json();
      const geminiResult = scanData?.result;
      if (!geminiResult) throw new Error('No se pudo leer la respuesta de IA');

      const parsed: any = {
        is_onepiece_card: geminiResult.tcg === 'onepiece',
        name: geminiResult.name || '',
        number: geminiResult.number || '',
        set_id: (geminiResult.number || '').split('-')[0] || '',
        rarity: geminiResult.rarity || '',
        type: '',
        color: [],
        cost: null,
        power: null,
        confidence: geminiResult.confidence || 0.5,
      };

      if (!parsed.is_onepiece_card) {
        setScanError('No parece una carta de One Piece TCG. Inténtalo con mejor iluminación.');
        setScanning(false);
        return;
      }
      const validated = await validateAgainstCatalog(
        parsed.name || '',
        parsed.number || '',
        parsed.set_id || ''
      );
      if (validated) {
        setResult({ ...validated, confidence: parsed.confidence ?? 0.8 });
      } else {
        setResult({
          id: parsed.number || '',
          name: parsed.name || 'Carta desconocida',
          number: parsed.number || '',
          set_id: parsed.set_id || '',
          set_name: parsed.set_id || '',
          rarity: parsed.rarity || '',
          type: parsed.type || '',
          color: Array.isArray(parsed.color) ? parsed.color : [],
          power: parsed.power ?? null,
          cost: parsed.cost ?? null,
          image_url: '',
          price_eur: null,
          confidence: parsed.confidence ?? 0.4,
        });
      }
      setScanCount(c => c + 1);
    } catch (e: any) {
      setScanError(e.message || 'Error al escanear');
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = () => {
    if (!result || !telegramUser?.id) return;
    addItem({
      card_id: result.id,
      tcg: 'onepiece',
      card_name: result.name,
      set_name: result.set_name,
      card_number: result.number,
      rarity: result.rarity,
      image_url: result.image_url,
      quantity: 1,
      favorite: false,
      market_price: result.price_eur ?? null,
      currency: 'EUR',
    } as any);
    setAdded(true);
    setTimeout(() => { setResult(null); setAdded(false); }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <style>{`
        @keyframes focusFade { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1.6)} }
        @keyframes scanLine { 0%{top:10%} 50%{top:85%} 100%{top:10%} }
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

      {/* Cámara */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        <div ref={overlayRef} className="absolute inset-0" onTouchStart={handleTapFocus} />

        {/* Marco de escaneo */}
        {cameraReady && !result && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40" style={{
              WebkitMaskImage: 'radial-gradient(ellipse 60% 75% at 50% 50%, transparent 100%, black 100%)',
              maskImage: 'radial-gradient(ellipse 60% 75% at 50% 50%, transparent 100%, black 100%)',
            }} />
            <div className="relative w-64 h-80 border-2 border-red-500/70 rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-400 rounded-br-xl" />
              <div className="scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent pointer-events-none" />
            </div>
            <p className="absolute bottom-[22%] text-xs text-white/70 text-center px-8">
              Coloca la carta dentro del marco · Toca para enfocar
            </p>
          </div>
        )}

        {/* Linterna */}
        {cameraReady && torchAvailable && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <button onClick={toggleTorch}
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${torchOn ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-400' : 'bg-black/40 border-white/20 text-white/60'}`}>
              💡
            </button>
          </div>
        )}

        {/* Error cámara */}
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
      <div className="bg-[#0a0a0f] border-t border-white/8 px-4 pt-3 pb-4 space-y-3 z-10">

        {/* Error escaneo */}
        {scanError && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300 flex-1">{scanError}</p>
            <button onClick={() => setScanError('')} className="text-gray-500">
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
                  className="w-16 object-cover rounded-xl shrink-0"
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
                {result.rarity && <p className="text-[10px] text-yellow-400">{result.rarity}</p>}
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
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-gray-400 flex items-center justify-center gap-1.5 active:scale-95">
                <RotateCcw size={12} /> Repetir
              </button>
              <button onClick={handleAdd}
                className="py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                <Plus size={12} /> Añadir
              </button>
            </div>
          </div>
        )}

        {/* Éxito */}
        {added && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-400">¡Añadida a tu colección!</p>
              <p className="text-xs text-gray-400">Escaneando siguiente carta...</p>
            </div>
          </div>
        )}

        {/* Botón escanear */}
        {!result && !added && (
          <button
            onClick={scan}
            disabled={!cameraReady || scanning}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            style={{ background: scanning ? '#1a1a2e' : 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
          >
            {scanning ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Analizando carta...
              </>
            ) : (
              <>
                <ScanLine size={20} />
                Escanear carta
              </>
            )}
          </button>
        )}

        {!result && !scanning && (
          <p className="text-[10px] text-gray-600 text-center">
            {torchAvailable ? '💡 Usa la linterna en condiciones de poca luz · ' : ''}
            Toca la pantalla para enfocar
          </p>
        )}
      </div>
    </div>
  );
}