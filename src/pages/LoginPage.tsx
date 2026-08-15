import { useState } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';

async function verifyCode(code: string): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch(`/api/auth-code?code=${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function LoginPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    window.open('https://t.me/CollectIQ_bot/app?startapp=pwa', '_blank');
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    setError('');

    const result = await verifyCode(code);
    if (result?.token) {
      localStorage.setItem('collectiq-session-token', result.token);
      window.location.href = '/';
    } else {
      setError('Código inválido o expirado. Inténtalo de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center px-6 gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <ScanLine size={36} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">CollectIQ</h1>
          <p className="text-gray-400 mt-2">Tu colección de cartas Pokémon TCG</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-[#111118] border border-white/8 rounded-2xl p-6 flex flex-col gap-4">
        <p className="text-sm text-gray-400 text-center font-medium">
          Paso 1 — Obtén tu código
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-[#2AABEE] text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          Abrir en Telegram
        </button>

        <div className="border-t border-white/8 pt-4">
          <p className="text-sm text-gray-400 text-center font-medium mb-3">
            Paso 2 — Introduce el código
          </p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-widest placeholder-gray-700 focus:outline-none focus:border-blue-500/50"
            inputMode="numeric"
            maxLength={6}
          />
          {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full mt-3 bg-blue-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Iniciar sesión'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        El código expira en 5 minutos
      </p>
    </div>
  );
}