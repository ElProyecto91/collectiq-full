import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Zap, ZapOff } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
  onCapture: (photo: File) => void;
  onClose: () => void;
  /** The camera could not be opened (no permission, no API, embedded browser): the caller falls back to the system camera. */
  onUnavailable: (reason: string) => void;
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Live rear camera with a flash (torch) button. The flash needs a live stream: the system camera
 * opened by <input capture> cannot be controlled from the page. Browsers that do not expose the
 * torch (iOS Safari, desktop) get the camera without the button and a short note.
 */
export function LegoCamera({ onCapture, onClose, onUnavailable }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchSupported(!!caps.torch);
        const video = videoRef.current;
        if (video) { video.srcObject = stream; await video.play().catch(() => undefined); }
        setReady(true);
      } catch (e) {
        if (!cancelled) onUnavailable(e instanceof Error ? e.name : 'camera_error');
      }
    })();
    return () => {
      cancelled = true;
      // stopping the track also turns the torch off
      (stream ?? (videoRef.current?.srcObject as MediaStream | null))?.getTracks().forEach((tr) => tr.stop());
      trackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
      setError(null);
    } catch {
      setTorchSupported(false);
      setError(t.lego.cameraNoFlash);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], 'scan.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={t.lego.scanner}>
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" data-testid="camera-video" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/60" /></div>}
        {/* framing guide: the piece goes in the middle, the color analysis looks there */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2/3 aspect-square rounded-3xl border-2 border-white/50" />
        </div>
        <button onClick={onClose} aria-label={t.lego.cameraClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"><X className="w-5 h-5" /></button>
        {ready && !torchSupported && !error && <p className="absolute top-4 right-4 left-16 text-[11px] text-white/60 text-right">{t.lego.cameraNoFlash}</p>}
        {error && <p className="absolute top-4 right-4 left-16 text-[11px] text-yellow-300 text-right" role="alert">{error}</p>}
      </div>
      <div className="flex items-center justify-around px-6 py-6 bg-black">
        <div className="w-12 h-12">
          {torchSupported && (
            <button onClick={toggleTorch} aria-pressed={torchOn} aria-label={torchOn ? t.lego.cameraFlashOff : t.lego.cameraFlashOn}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${torchOn ? 'bg-yellow-400 text-black' : 'bg-white/15 text-white'}`}>
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>)}
        </div>
        <button onClick={capture} disabled={!ready} aria-label={t.lego.takePhoto}
          className="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/20 active:bg-white/50 disabled:opacity-30" />
        <div className="w-12 h-12" />
      </div>
    </div>
  );
}
