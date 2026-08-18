import { Plus, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DecksPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-2xl font-bold">Mis Mazos</h1>
          <p className="text-sm text-gray-500">Crea y comparte tus mazos.</p>
        </div>
        <button
          onClick={() => navigate('/decks/new')}
          className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center active:scale-95 transition-transform">
          <Plus size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-4 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Layers size={28} className="text-gray-600" />
        </div>
        <div>
          <p className="text-white font-semibold">Aun no tienes mazos</p>
          <p className="text-sm text-gray-500 mt-1">Crea tu primer mazo de 60 cartas y compartelo con la comunidad.</p>
        </div>
        <button
          onClick={() => navigate('/decks/new')}
          className="bg-blue-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
          <Plus size={18} />
          Crear mazo
        </button>
      </div>
    </div>
  );
}