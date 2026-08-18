import { Users, Flame, Trophy, Plus, Layers } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type CommunityTab = 'decks' | 'collections' | 'ranking';

export function CommunityPage() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('decks');
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-2xl font-bold">Comunidad</h1>
          <p className="text-sm text-gray-500">Mazos, colecciones y mas.</p>
        </div>
        {activeTab === 'decks' && (
          <button onClick={() => navigate('/decks/new')}
            className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center active:scale-95 transition-transform">
            <Plus size={18} className="text-white" />
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          {[
            { key: 'decks', label: 'Mazos', icon: <Flame size={13} /> },
            { key: 'collections', label: 'Colecciones', icon: <Users size={13} /> },
            { key: 'ranking', label: 'Ranking', icon: <Trophy size={13} /> },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as CommunityTab)}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ' + (activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400')}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'decks' && (
          <>
            {/* Acceso rapido a mis mazos */}
            <button onClick={() => navigate('/decks')}
              className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 active:scale-95 transition-transform">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Layers size={16} className="text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-white">Mis mazos</p>
                <p className="text-xs text-gray-500">Ver y gestionar tus mazos</p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Flame size={28} className="text-gray-600" />
              </div>
              <div>
                <p className="text-white font-semibold">Sin mazos publicos todavia</p>
                <p className="text-sm text-gray-500 mt-1">Se el primero en publicar un mazo.</p>
              </div>
              <button onClick={() => navigate('/decks/new')}
                className="bg-blue-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
                <Plus size={18} />
                Crear mi primer mazo
              </button>
            </div>
          </>
        )}

        {activeTab === 'collections' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Users size={28} className="text-gray-600" />
            </div>
            <p className="text-white font-semibold">Colecciones proximamente</p>
            <p className="text-sm text-gray-500">Pronto podras ver las colecciones de otros usuarios.</p>
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Trophy size={28} className="text-gray-600" />
            </div>
            <p className="text-white font-semibold">Ranking proximamente</p>
            <p className="text-sm text-gray-500">Los mazos mas votados apareceran aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}