import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';

export function BugReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useUserStore(s => s.telegramUser);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // La página de origen puede pasarse como state o query param
  const fromPage = (location.state as any)?.from || document.referrer || 'unknown';

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      const { error: err } = await supabase.from('bug_reports').insert({
        telegram_user_id: telegramUser?.id ?? 0,
        username: telegramUser?.username ?? null,
        message: message.trim(),
        page: fromPage,
        platform: window.Telegram?.WebApp ? 'telegram' : 'pwa',
        app_version: '0.1.0',
        status: 'open',
      });
      if (err) throw err;
      setSent(true);
    } catch {
      setError('❌ Error al enviar. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
            <h1 className="text-lg font-bold leading-tight">Reportar fallo</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {sent ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">¡Gracias!</p>
              <p className="text-sm text-gray-400 mt-1">Tu reporte ha sido enviado. Lo revisaremos pronto.</p>
            </div>
            <button onClick={() => navigate(-1)}
              className="bg-white/10 text-white px-6 py-3 rounded-2xl text-sm font-medium active:scale-95 transition-transform">
              Volver
            </button>
          </div>
        ) : (
          <>
            {/* Info */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Cuéntanos qué ha pasado</p>
                <p className="text-xs text-gray-400 mt-1">
                  Incluye todos los detalles posibles: qué estabas haciendo, qué esperabas y qué pasó en su lugar.
                </p>
              </div>
            </div>

            {/* Mensaje */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Descripción del problema *</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ej: Al intentar añadir una carta al marketplace, la app se cierra sin guardar..."
                rows={7}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <p className="text-[10px] text-gray-600 mt-1">{message.length} caracteres</p>
            </div>

            {/* Info técnica automática */}
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Info técnica (automática)</p>
              <p className="text-[10px] text-gray-600">
                Usuario: @{telegramUser?.username || telegramUser?.id || 'desconocido'}
              </p>
              <p className="text-[10px] text-gray-600">
                Plataforma: {window.Telegram?.WebApp ? 'Telegram Mini App' : 'PWA/Web'}
              </p>
              <p className="text-[10px] text-gray-600">Versión: v0.1.0</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={sending || !message.trim()}
              className="w-full bg-orange-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
              {sending ? 'Enviando...' : 'Enviar reporte'}
            </button>

            <p className="text-[10px] text-gray-600 text-center">
              Tu reporte ayuda a mejorar CollectIQ para toda la comunidad.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
