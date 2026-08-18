import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸', native: 'Español' },
  { code: 'en', label: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', native: 'Français' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', native: 'Italiano' },
  { code: 'pt', label: 'Português', flag: '🇧🇷', native: 'Português' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵', native: '日本語' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳', native: '中文' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺', native: 'Русский' },
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
            {LANGUAGES.map(lang => (
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
                <div className="text-left">
                  <p className="text-sm font-medium">{lang.native}</p>
                </div>
                {selectedLang === lang.code && <span className="ml-auto text-blue-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-base active:scale-95 transition-transform"
      >
        Continuar →
      </button>
    </div>
  );
}