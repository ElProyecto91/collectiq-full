import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Star, Package, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';
import { useCollectionList } from '@/hooks/use-collection';
import { useCurrency } from '@/hooks/use-currency';
import { useMissions } from '@/hooks/use-missions';
import { useNavigate } from 'react-router-dom';

interface Snapshot {
  total_value: number;
  total_cards: number;
  unique_cards: number;
  created_at: string;
}

function MiniChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) return null;

  const values = snapshots.map(s => s.total_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 300;
  const height = 60;
  const padding = 4;

  const points = snapshots.map((s, i) => {
    const x = padding + (i / (snapshots.length - 1)) * (width - padding * 2);
    const y = height - padding - ((s.total_value - min) / range) * (height - padding * 2);
    return x + ',' + y;
  }).join(' ');

  const isUp = snapshots[snapshots.length - 1].total_value >= snapshots[0].total_value;

  return (
    <svg viewBox={'0 0 ' + width + ' ' + height} className="w-full h-16">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BlurredChart() {
  // Gráfico falso borroso para usuarios FREE
  const fakePoints = "4,50 40,35 80,45 120,20 160,30 200,15 240,25 280,10 296,18";
  return (
    <div className="relative">
      <svg viewBox="0 0 300 60" className="w-full h-16 blur-sm opacity-60">
        <polyline points={fakePoints} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-[#111118]/90 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
          <Lock size={12} className="text-yellow-400" />
          <p className="text-xs text-yellow-400 font-bold">Solo GO</p>
        </div>
      </div>
    </div>
  );
}

export function StatsPage() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: cards = [] } = useCollectionList();
  const { formatPrice } = useCurrency();
  const { updateMission } = useMissions();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  const totalValue = cards.reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const favorites = cards.filter(c => c.favorite).length;

  const topCards = [...cards]
    .filter(c => (c.marketPrice ?? c.tcgplayerPrice ?? 0) > 0)
    .sort((a, b) => (b.marketPrice ?? b.tcgplayerPrice ?? 0) - (a.marketPrice ?? a.tcgplayerPrice ?? 0))
    .slice(0, 5);

  const setGroups = Object.values(
    cards.reduce((acc, card) => {
      const key = card.setName ?? '';
      if (!acc[key]) acc[key] = { setName: key, count: 0, value: 0 };
      acc[key].count += card.quantity;
      acc[key].value += (card.marketPrice ?? card.tcgplayerPrice ?? 0) * card.quantity;
      return acc;
    }, {} as Record<string, { setName: string; count: number; value: number }>)
  ).sort((a, b) => b.value - a.value).slice(0, 5);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadSnapshots();
    updateMission('check_value');
    supabase.from('user_premium').select('plan, expires_at')
      .eq('telegram_user_id', telegramUser.id).maybeSingle()
      .then(({ data }) => {
        const isExpired = data?.expires_at ? new Date(data.expires_at) < new Date() : true;
        setIsPremium(data?.plan === 'go' && !isExpired);
      });
  }, [telegramUser?.id]);

  useEffect(() => {
    if (!telegramUser?.id || totalValue === 0) return;
    saveSnapshot();
  }, [telegramUser?.id, totalValue]);

  const loadSnapshots = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('collection_snapshots')
        .select('total_value, total_cards, unique_cards, created_at')
        .eq('telegram_user_id', telegramUser.id)
        .order('created_at', { ascending: true })
        .limit(30);
      setSnapshots(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSnapshot = async () => {
    if (!telegramUser?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('collection_snapshots')
      .select('id')
      .eq('telegram_user_id', telegramUser.id)
      .gte('created_at', today + 'T00:00:00')
      .maybeSingle();

    if (!existing) {
      await supabase.from('collection_snapshots').insert({
        telegram_user_id: telegramUser.id,
        total_value: totalValue,
        total_cards: totalCards,
        unique_cards: uniqueCards,
      });
    }
  };

  const yesterday = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const weekAgo = snapshots.length >= 7 ? snapshots[snapshots.length - 7] : snapshots[0];
  const monthAgo = snapshots[0];

  const diff24h = yesterday ? totalValue - yesterday.total_value : 0;
  const diff7d = weekAgo ? totalValue - weekAgo.total_value : 0;
  const diff30d = monthAgo ? totalValue - monthAgo.total_value : 0;

  const pct = (diff: number) => totalValue > 0 ? ((diff / (totalValue - diff)) * 100).toFixed(1) : '0';

  function DiffBadge({ diff }: { diff: number }) {
    if (diff === 0) return <span className="text-xs text-gray-500 flex items-center gap-0.5"><Minus size={10} /> 0%</span>;
    const up = diff > 0;
    return (
      <span className={'text-xs flex items-center gap-0.5 ' + (up ? 'text-green-400' : 'text-red-400')}>
        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {up ? '+' : ''}{pct(diff)}%
      </span>
    );
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      <div>
        <h1 className="text-2xl font-bold text-white">Estadisticas</h1>
        <p className="text-sm text-gray-500">Evolucion y valor de tu coleccion.</p>
      </div>

      {/* Valor total */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500">Valor total estimado</p>
            <p className="text-3xl font-bold text-white mt-1">{formatPrice(totalValue)}</p>
          </div>
          <DiffBadge diff={diff24h} />
        </div>

        {/* Gráfico — borroso para FREE */}
        {isPremium === true && snapshots.length >= 2 && <MiniChart snapshots={snapshots} />}
        {isPremium === false && (
          <div className="space-y-2">
            <BlurredChart />
            <button onClick={() => navigate('/premium')}
              className="w-full py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Lock size={12} />Desbloquear historial con GO
            </button>
          </div>
        )}

        {/* Diferencias — solo GO */}
        {isPremium === true ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '24h', diff: diff24h },
              { label: '7 dias', diff: diff7d },
              { label: '30 dias', diff: diff30d },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                <p className={'text-xs font-bold ' + (item.diff > 0 ? 'text-green-400' : item.diff < 0 ? 'text-red-400' : 'text-gray-400')}>
                  {item.diff > 0 ? '+' : ''}{formatPrice(item.diff)}
                </p>
                <DiffBadge diff={item.diff} />
              </div>
            ))}
          </div>
        ) : isPremium === false ? (
          <div className="grid grid-cols-3 gap-2">
            {['24h', '7 dias', '30 dias'].map(label => (
              <div key={label} className="bg-white/5 rounded-xl p-2 text-center relative overflow-hidden">
                <p className="text-[10px] text-gray-500 mb-1">{label}</p>
                <p className="text-xs font-bold text-gray-700 blur-sm">+99.99€</p>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock size={10} className="text-yellow-400" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Stats básicas — siempre visibles */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Cartas totales', value: totalCards, color: 'text-blue-400', emoji: '🃏' },
          { label: 'Cartas unicas', value: uniqueCards, color: 'text-purple-400', emoji: '✨' },
          { label: 'Favoritas', value: favorites, color: 'text-yellow-400', emoji: '⭐' },
          { label: 'Sets', value: setGroups.length, color: 'text-green-400', emoji: '📦' },
        ].map(item => (
          <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">{item.emoji}</span>
            <div>
              <p className={'text-xl font-bold ' + item.color}>{item.value}</p>
              <p className="text-[10px] text-gray-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cartas más valiosas — solo GO */}
      {topCards.length > 0 && (
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-yellow-400" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cartas mas valiosas</p>
            {isPremium === false && <span className="ml-auto text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 flex items-center gap-1"><Lock size={9} />GO</span>}
          </div>
          {isPremium === true ? (
            topCards.map((card, i) => {
              const price = card.marketPrice ?? card.tcgplayerPrice ?? 0;
              return (
                <div key={card.id} className="flex items-center gap-3">
                  <span className={'text-xs font-bold w-5 text-center ' + (i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600')}>
                    {i + 1}
                  </span>
                  <img src={card.imageUrl ?? ''} alt={card.cardName} className="w-8 h-11 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{card.cardName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
                  </div>
                  <p className="text-xs font-bold text-green-400 shrink-0">{formatPrice(price)}</p>
                </div>
              );
            })
          ) : (
            <div className="space-y-2">
              {topCards.slice(0, 3).map((card, i) => (
                <div key={card.id} className="flex items-center gap-3 blur-sm opacity-50">
                  <span className="text-xs font-bold w-5 text-center text-gray-600">{i + 1}</span>
                  <img src={card.imageUrl ?? ''} alt={card.cardName} className="w-8 h-11 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{card.cardName}</p>
                  </div>
                  <p className="text-xs font-bold text-green-400">€??.??</p>
                </div>
              ))}
              <button onClick={() => navigate('/premium')}
                className="w-full py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Lock size={12} />Desbloquear con GO
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sets más valiosos — solo GO */}
      {setGroups.length > 0 && (
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-blue-400" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Sets mas valiosos</p>
            {isPremium === false && <span className="ml-auto text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 flex items-center gap-1"><Lock size={9} />GO</span>}
          </div>
          {isPremium === true ? (
            setGroups.map((group) => (
              <div key={group.setName} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs truncate flex-1 mr-2">{group.setName}</p>
                  <p className="text-xs text-green-400 font-bold shrink-0">{formatPrice(group.value)}</p>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1">
                  <div className="bg-blue-500 h-1 rounded-full" style={{ width: (group.value / setGroups[0].value * 100) + '%' }} />
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {setGroups.slice(0, 2).map((group) => (
                <div key={group.setName} className="space-y-1 blur-sm opacity-50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs truncate flex-1 mr-2">{group.setName}</p>
                    <p className="text-xs text-green-400 font-bold">€??.??</p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full w-3/4" />
                  </div>
                </div>
              ))}
              <button onClick={() => navigate('/premium')}
                className="w-full py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Lock size={12} />Desbloquear con GO
              </button>
            </div>
          )}
        </div>
      )}

      {/* ROI — solo GO */}
      {cards.some(c => c.purchasePrice) && (
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-purple-400" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">ROI — Retorno de inversion</p>
            {isPremium === false && <span className="ml-auto text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 flex items-center gap-1"><Lock size={9} />GO</span>}
          </div>
          {isPremium === true ? (
            (() => {
              const totalPaid = cards.filter(c => c.purchasePrice).reduce((s, c) => s + ((c.purchasePrice ?? 0) * c.quantity), 0);
              const totalMarket = cards.filter(c => c.purchasePrice).reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);
              const roi = totalPaid > 0 ? ((totalMarket - totalPaid) / totalPaid * 100) : 0;
              const isPositive = roi >= 0;
              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500">Invertido</p>
                      <p className="text-sm font-bold text-white">{formatPrice(totalPaid)}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500">Valor actual</p>
                      <p className="text-sm font-bold text-white">{formatPrice(totalMarket)}</p>
                    </div>
                  </div>
                  <div className={'rounded-xl p-3 text-center ' + (isPositive ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20')}>
                    <p className="text-[10px] text-gray-500 mb-1">Retorno total</p>
                    <p className={'text-2xl font-bold ' + (isPositive ? 'text-green-400' : 'text-red-400')}>
                      {isPositive ? '+' : ''}{roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })()
          ) : (
            <button onClick={() => navigate('/premium')}
              className="w-full py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Lock size={12} />Desbloquear ROI con GO
            </button>
          )}
        </div>
      )}

      {snapshots.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500 text-xs">
          El grafico aparecera cuando tengamos datos de al menos 2 dias.
        </div>
      )}
    </div>
  );
}