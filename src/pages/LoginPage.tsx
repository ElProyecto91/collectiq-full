import { ScanLine } from 'lucide-react';

const BOT_USERNAME = 'CollectIQ_bot';
const APP_URL = 'https://collectiq-full.vercel.app';

export function LoginPage() {
  const handleLogin = () => {
    window.open(`https://t.me/${BOT_USERNAME}?start=login`, '_blank');
  };

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
          Abre CollectIQ desde Telegram para acceder a tu colección
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-[#2AABEE] text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          Abrir en Telegram
        </button>
        <p className="text-xs text-gray-600 text-center">
          Una vez abierto en Telegram, la próxima vez que uses la app recordará tu sesión automáticamente.
        </p>
      </div>
    </div>
  );
}