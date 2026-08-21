import { useNavigate } from 'react-router-dom';
import { RoutePaths } from '@/config';
import { ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  {
    key: 'pokemon',
    label: 'Pokémon TCG',
    emoji: '⚡',
    desc: 'Cartas, escáner IA, deck builder y más',
    route: RoutePaths.Home,
    color: 'from-yellow-500/20 to-red-500/20',
    border: 'border-yellow-500/30',
    active: true,
  },
  {
    key: 'funko',
    label: 'Funko Pop',
    emoji: '🎭',
    desc: 'Colección, escáner, precios y wishlist',
    route: RoutePaths.FunkoHome,
    color: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
    active: true,
  },
  {
    key: 'yugioh',
    label: 'Yu-Gi-Oh!',
    emoji: '🃏',
    desc: 'Próximamente',
    route: null,
    color: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-white/8',
    active: false,
  },
  {
    key: 'onepiece',
    label: 'One Piece TCG',
    emoji: '⚓',
    desc: 'Próximamente',
    route: null,
    color: 'from-red-500/10 to-orange-500/10',
    border: 'border-white/8',
    active: false,
  },
  {
    key: 'magic',
    label: 'Magic: The Gathering',
    emoji: '🔮',
    desc: 'Próximamente',
    route: null,
    color: 'from-indigo-500/10 to-purple-500/10',
    border: 'border-white/8',
    active: false,
  },
  {
    key: 'lorcana',
    label: 'Lorcana',
    emoji: '✨',
    desc: 'Próximamente',
    route: null,
    color: 'from-blue-500/10 to-cyan-500/10',
    border: 'border-white/8',
    active: false,
  },
];

export function CollectablesHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.Home)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Mis colecciones</h1>
        </div>
      </div>

      <div className="px-4 space-y-3">
        <p className="text-xs text-gray-500">Elige una categoría para gestionar tu colección</p>

        {CATEGORIES.map(cat => (
          <button key={cat.key}
            onClick={() => cat.route ? navigate(cat.route) : null}
            disabled={!cat.active}
            className={`w-full bg-gradient-to-r ${cat.color} border ${cat.border} rounded-2xl p-4 flex items-center gap-4 text-left transition-all ${cat.active ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-3xl">{cat.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{cat.label}</p>
                {cat.active && (
                  <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">ACTIVO</span>
                )}
                {!cat.active && (
                  <span className="text-[9px] bg-white/5 text-gray-500 border border-white/10 px-1.5 py-0.5 rounded-full font-bold">PRONTO</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
            </div>
            {cat.active && <span className="text-gray-400 shrink-0">›</span>}
          </button>
        ))}

        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 mt-4">
          <p className="text-xs text-gray-400 text-center">¿Qué categoría quieres que añadamos antes?</p>
          <p className="text-[10px] text-gray-600 text-center mt-1">Vota en tu perfil → "¿Qué quieres que añadamos?"</p>
        </div>
      </div>
    </div>
  );
}