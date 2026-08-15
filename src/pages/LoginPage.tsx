import { useEffect } from 'react';
import { ScanLine } from 'lucide-react';

const BOT_NAME = 'CollectIQ_bot';

export function LoginPage() {
  useEffect(() => {
    // Cargar el script del widget de Telegram
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_NAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', 'https://collectiq-full.vercel.app/api/telegram-callback');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = document.getElementById('telegram-login-container');
    if (container) container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <ScanLine size={36} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">CollectIQ</h1>
          <p className="text-gray-400 mt-2">Tu colección de cartas Pokémon TCG</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-[#111118] border border-white/8 rounded-2xl p-6 flex flex-col items-center gap-4">
        <p className="text-sm text-gray-400 text-center">
          Inicia sesión con tu cuenta de Telegram para acceder a tu colección
        </p>
        <div id="telegram-login-container" />
      </div>

      <p className="text-xs text-gray-600 text-center">
        Al iniciar sesión, aceptas que CollectIQ acceda a tu información básica de Telegram.
      </p>
    </div>
  );
}