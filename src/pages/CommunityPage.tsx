import { Users, Flame, Trophy, Search } from 'lucide-react';

export function CommunityPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4">
        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
        <h1 className="text-2xl font-bold">Comunidad</h1>
        <p className="text-sm text-gray-500">Mazos, colecciones y más.</p>
      </div>

      <div className="px-4 space-y-4">
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          {['Mazos', 'Colecciones', 'Ranking'].map((tab, i) => (
            <button key={tab}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ' + (i === 0 ? 'bg-blue-600 text-white' : 'text-gray-400')}>
              {i === 0 && <Flame size={13} />}
              {i === 1 && <Users size={13} />}
              {i === 2 && <Trophy size={13} />}
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Users size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Comunidad próximamente</p>
            <p className="text-sm text-gray-500 mt-1">Pronto podrás ver mazos, colecciones y conectar con otros coleccionistas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}