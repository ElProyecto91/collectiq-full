import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LANGUAGES_AVAILABLE = [
  { code: 'es', label: 'Español', flag: '🇪🇸', native: 'Español' },
  { code: 'en', label: 'English', flag: '🇬🇧', native: 'English' },
];

const LANGUAGES_SOON = [
  { code: 'fr', flag: '🇫🇷', native: 'Français' },
  { code: 'de', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', native: 'Italiano' },
  { code: 'pt', flag: '🇧🇷', native: 'Português' },
  { code: 'ja', flag: '🇯🇵', native: '日本語' },
  { code: 'zh', flag: '🇨🇳', native: '中文' },
  { code: 'ar', flag: '🇸🇦', native: 'العربية' },
  { code: 'ru', flag: '🇷🇺', native: 'Русский' },
];

export function OnboardingPage() {
  const [selectedLang, setSelectedLang] = useState('es');
  const navigate = useNavigate();

  const handleContinue = () => {
    localStorage.setItem('i18n-locale', selectedLang);
    localStorage.setItem('collectiq-onboarding-done', 'true');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col px-4 py-8">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">

        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🎴</span>
          </div>
          <h1 className="text-3xl font-bold">CollectIQ</h1>
          <p className="text-gray-400 text-sm">La app definitiva para coleccionistas de cartas TCG</p>
        </div>

        <div className="w-full space-y-3">
          <p className="text-center text-sm font-medium text-gray-400">Elige tu idioma / Choose your language</p>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES_AVAILABLE.map(lang => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ' + (
                  selectedLang === lang.code
                    ? 'bg-blue-500/10 border-blue-500/30 text-white'
                    : 'bg-white/5 border-white/8 text-gray-400 active:scale-95'
                )}
              >
                <span className="text-2xl">{lang.flag}</span>
                <p className="text-sm font-medium">{lang.native}</p>
                {selectedLang === lang.code && <span className="ml-auto text-blue-400 text-xs">✓</span>}
              </button>
            ))}
          </div>

          <div className="mt-2">
            <p className="text-center text-xs text-gray-600 mb-2">Próximamente</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {LANGUAGES_SOON.map(lang => (
                <div key={lang.code}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/3 border border-white/5 opacity-50">
                  <span className="text-base">{lang.flag}</span>
                  <span className="text-xs text-gray-600">{lang.native}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-base active:scale-95 transition-transform mt-6"
      >
        Continuar →
      </button>
    </div>
  );
}