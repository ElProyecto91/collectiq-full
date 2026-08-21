import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Zap, Star, Tv, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { usePremium, GO_PRICE_STARS } from '@/hooks/use-premium';
import { usePremium, GO_PRICE_STARS } from '@/hooks/use-premium';
import { useAnalytics } from '@/hooks/use-analytics';
import { useUserStore } from '@/store';

const FREE_FEATURES = [
  '5 escaneos con IA al dia',
  'Ver anuncios para conseguir +1 escaneo extra sin límite',
  'Coleccion ilimitada',
  'Explorador de cartas',
  'Deck builder completo',
  'Comunidad y mazos publicos',
  'Estadisticas basicas',
  'Importar/Exportar CSV',
  'Sistema de logros y XP',
  'Misiones diarias',
  'Perfil publico compartible',
];

const GO_FEATURES = [
  'Escaneos ilimitados con IA',
  'Sin publicidad',
  'Estadisticas avanzadas de portfolio',
  'Historial completo de precios',
  'Badge GO exclusivo en perfil',
  'Acceso anticipado a nuevas features',
  'Soporte prioritario',
  'Live overlays para streaming',
  'Exportar mazo a PTCGLive',
  'Todo lo del plan gratuito',
];

export function PremiumPage() {
  const navigate = useNavigate();
  const { premium, isLoading } = usePremium();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const { track } = useAnalytics();

  const handleUpgrade = async () => {
    if (!telegramUser?.id) {
      setPayError('Debes estar conectado con Telegram para suscribirte.');
      return;
    }

    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      setPayError('El pago con Stars solo está disponible dentro de Telegram.');
      return;
    }

    setIsPaying(true);
    setPayError('');

    try {
      const res = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId: telegramUser.id }),
      });

      const data = await res.json();
      if (!data.invoiceLink) throw new Error(data.error ?? 'Error al crear el pago');
track('go_purchase_started', { stars: GO_PRICE_STARS });
tg.openInvoice(data.invoiceLink, (status: string) => {
      tg.openInvoice(data.invoiceLink, (status: string) => {
        setIsPaying(false);
        if (status === 'paid') {
          tg.showAlert('✅ ¡Pago completado! Tu plan GO estará activo en unos segundos. Reinicia la app para verlo.');
track('go_purchase_completed', { stars: GO_PRICE_STARS });
        } else if (status === 'cancelled') {
          setPayError('Pago cancelado.');
track('go_purchase_cancelled');
        } else if (status === 'failed') {
          setPayError('El pago falló. Inténtalo de nuevo.');
        }
      });
    } catch (err: any) {
      setIsPaying(false);
      setPayError(err?.message ?? 'Error al procesar el pago.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">CollectIQ GO</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {premium.isGO ? (
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-5 text-center space-y-2">
            <p className="text-3xl">⭐</p>
            <p className="text-xl font-black" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Eres CollectIQ GO</p>
            <p className="text-sm text-gray-400">
              Tu plan expira el {premium.expiresAt ? new Date(premium.expiresAt).toLocaleDateString('es-ES') : '—'}
            </p>
            <p className="text-xs text-gray-500">Has contribuido con {premium.starsPaid} ⭐ Stars</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-5 text-center space-y-2">
            <p className="text-3xl">🚀</p>
            <p className="text-xl font-black text-white">Mejora a CollectIQ GO</p>
            <p className="text-sm text-gray-400">Desbloquea todo el potencial de CollectIQ</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Star size={18} className="text-yellow-400 fill-yellow-400" />
              <p className="text-2xl font-black text-yellow-400">{GO_PRICE_STARS} Stars</p>
              <p className="text-sm text-gray-500">/mes</p>
            </div>
            <p className="text-xs text-gray-600">~1.80€ · Sin renovación automática</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">

          {/* Plan FREE */}
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">Gratuito</p>
              <p className="text-xs text-gray-500">Para siempre</p>
              <p className="text-xl font-black text-white mt-1">0€</p>
            </div>
            <div className="space-y-1.5">
              {FREE_FEATURES.map(f => (
                <div key={f} className="flex items-start gap-1.5">
                  <Check size={11} className="text-green-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-gray-400">{f}</p>
                </div>
              ))}
            </div>
            {!premium.isGO && (
              <div className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-xs text-gray-400 font-medium">Plan actual</p>
              </div>
            )}
          </div>

          {/* Plan GO */}
          <div className={'rounded-2xl p-4 space-y-3 relative overflow-hidden ' + (premium.isGO ? 'bg-yellow-500/10 border-2 border-yellow-500/30' : 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500/30')}>
            <div className="absolute top-2 right-2">
              <span className="text-[9px] bg-yellow-500 text-black font-black px-2 py-0.5 rounded-full">GO</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">CollectIQ GO</p>
              <p className="text-xs text-gray-500">Por mes</p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <p className="text-xl font-black text-yellow-400">{GO_PRICE_STARS}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {GO_FEATURES.map(f => (
                <div key={f} className="flex items-start gap-1.5">
                  <Zap size={11} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white">{f}</p>
                </div>
              ))}
            </div>
            {premium.isGO ? (
              <div className="w-full py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-center">
                <p className="text-xs text-yellow-400 font-bold">✓ Plan activo</p>
              </div>
            ) : (
              <button onClick={handleUpgrade} disabled={isPaying}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-black active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isPaying
                  ? <><Loader2 size={12} className="animate-spin" />Procesando...</>
                  : <>⭐ Activar GO — {GO_PRICE_STARS} Stars</>}
              </button>
            )}
          </div>
        </div>

        {payError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 text-center">
            {payError}
          </div>
        )}

        {/* Info escaneos */}
        {!premium.isGO && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Límite de escaneos</p>
            <p className="text-sm text-white">Con el plan gratuito tienes <span className="text-blue-400 font-bold">5 escaneos</span> al día con IA.</p>
            <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
              <Tv size={14} className="text-green-400 shrink-0 mt-0.5" />
              <p className="text-xs text-green-300">Ve un anuncio y consigue <span className="font-bold">+1 escaneo extra</span> sin límite diario.</p>
            </div>
            <p className="text-xs text-gray-500">Con <span className="text-yellow-400 font-bold">CollectIQ GO</span> los escaneos son ilimitados y sin publicidad.</p>
          </div>
        )}

        {/* FAQ */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Preguntas frecuentes</p>
          {[
            { q: '¿Que son las Telegram Stars?', a: 'Son la moneda virtual de Telegram. Puedes comprarlas desde la app de Telegram con tarjeta normal, Apple Pay o Google Pay.' },
            { q: '¿Se renueva automáticamente?', a: 'No, el plan es mensual y no se renueva solo. Cada mes decides si quieres continuar.' },
            { q: '¿Pierdo mis datos si no renuevo?', a: 'No, tu coleccion y datos siempre se mantienen independientemente del plan.' },
            { q: '¿Cuándo se activa el GO?', a: 'En segundos después del pago. Si no se activa, cierra y vuelve a abrir la app.' },
          ].map(item => (
            <div key={item.q} className="space-y-1">
              <p className="text-xs font-bold text-white">{item.q}</p>
              <p className="text-xs text-gray-500">{item.a}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}