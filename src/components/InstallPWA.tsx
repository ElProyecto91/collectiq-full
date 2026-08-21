import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Apple, Monitor, ExternalLink } from 'lucide-react';

interface InstallPWAProps {
  onClose: () => void;
}

type Platform = 'android' | 'ios' | 'desktop';

const APP_URL = 'https://collectiq-full.vercel.app';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function InstallPWA({ onClose }: InstallPWAProps) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallNative = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const handleOpenBrowser = () => {
    window.open(APP_URL, '_blank');
  };

  const steps = {
    android: [
      { emoji: '🌐', title: 'Abre Chrome', desc: 'Entra en collectiq-full.vercel.app desde Chrome en tu Android' },
      { emoji: '⋮', title: 'Pulsa los tres puntos', desc: 'Toca el icono de tres puntos arriba a la derecha del navegador' },
      { emoji: '📲', title: 'Añadir a pantalla de inicio', desc: 'Selecciona "Añadir a pantalla de inicio" o "Instalar aplicación"' },
      { emoji: '✅', title: '¡Listo!', desc: 'CollectIQ aparecerá en tu pantalla de inicio como una app normal' },
    ],
    ios: [
      { emoji: '🌐', title: 'Abre Safari', desc: 'Entra en collectiq-full.vercel.app desde Safari en tu iPhone o iPad' },
      { emoji: '⬆️', title: 'Pulsa compartir', desc: 'Toca el icono de compartir (cuadrado con flecha) en la barra inferior' },
      { emoji: '📲', title: 'Añadir a inicio', desc: 'Desplázate y selecciona "Añadir a pantalla de inicio"' },
      { emoji: '✅', title: '¡Listo!', desc: 'CollectIQ aparecerá en tu pantalla de inicio como una app normal' },
    ],
    desktop: [
      { emoji: '🌐', title: 'Abre Chrome o Edge', desc: 'Entra en collectiq-full.vercel.app desde tu ordenador' },
      { emoji: '📥', title: 'Icono de instalar', desc: 'Busca el icono de instalar en la barra de direcciones (flecha hacia abajo)' },
      { emoji: '✅', title: 'Instalar', desc: 'Pulsa "Instalar" en el diálogo que aparece' },
      { emoji: '🖥️', title: '¡Listo!', desc: 'CollectIQ se abrirá como una app independiente en tu escritorio' },
    ],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-blue-400" />
            <p className="text-sm font-bold text-white">Instalar CollectIQ</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Botón instalación nativa (Android/Desktop si disponible) */}
        {deferredPrompt && !installed && (
          <button onClick={handleInstallNative}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-blue-900/40">
            <Download size={16} />
            Instalar CollectIQ ahora
          </button>
        )}

        {installed && (
          <div className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold text-center">
            ✅ ¡CollectIQ instalado correctamente!
          </div>
        )}

        {/* Botón abrir en navegador */}
        <button onClick={handleOpenBrowser}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <ExternalLink size={15} className="text-blue-400" />
          Abrir en el navegador
        </button>

        <p className="text-xs text-gray-400">
          CollectIQ es una Progressive Web App (PWA) — se instala directamente desde el navegador, sin pasar por ninguna tienda de apps.
        </p>

        {/* Selector de plataforma */}
        <div className="flex gap-2">
          {([
            { key: 'android', label: 'Android', icon: <Smartphone size={14} /> },
            { key: 'ios', label: 'iPhone/iPad', icon: <Apple size={14} /> },
            { key: 'desktop', label: 'Ordenador', icon: <Monitor size={14} /> },
          ] as { key: Platform; label: string; icon: React.ReactNode }[]).map(p => (
            <button key={p.key} onClick={() => setPlatform(p.key)}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all ' + (
                platform === p.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/5 border-white/10 text-gray-400'
              )}>
              {p.icon}{p.label}
            </button>
          ))}
        </div>

        {/* Pasos */}
        <div className="space-y-3">
          {steps[platform].map((step, i) => (
            <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-400">{i + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{step.emoji}</span>
                  <p className="text-sm font-bold text-white">{step.title}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* También disponible en Telegram */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-blue-300">💬 También disponible en Telegram</p>
          <p className="text-xs text-gray-400">Busca <strong className="text-white">@CollectIQ_bot</strong> en Telegram y abre la mini app directamente.</p>
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95 transition-transform">
          ¡Entendido!
        </button>
      </div>
    </div>
  );
}