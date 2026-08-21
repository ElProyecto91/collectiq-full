import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { RoutePaths } from '@/config';

export function FunkoDetailPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Detalle Funko</h1>
        </div>
      </div>
      <div className="px-4 text-center py-12 text-gray-500 text-sm">Próximamente</div>
    </div>
  );
}