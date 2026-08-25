import { Heart, Trash2, ExternalLink, Bell, BellOff, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWishlistList, useDeleteWishlistItem } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';

type SortOption = 'recent' | 'name';

interface PriceAlert {
  id: string;
  card_id: string;
  target_price: number;
}

export function WishlistPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [settingAlert, setSettingAlert] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const { data: items = [], isLoading } = useWishlistList(search);
  const { mutate: deleteItem } = useDeleteWishlistItem();
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadAlerts();
  }, [telegramUser?.id]);

  const loadAlerts = async () => {
    if (!telegramUser?.id) return;
    const { data } = await supabase
      .from('price_alerts')
      .select('id, card_id, target_price')
      .eq('telegram_user_id', telegramUser.id)
      .eq('triggered', false);
    setAlerts(data ?? []);
  };

  const getAlert = (cardId: string) => alerts.find(a => a.card_id === cardId);

  const saveAlert = async (cardId: string, cardName: string, imageUrl: string | null) => {
    if (!telegramUser?.id || !alertPrice) return;
    setSavingAlert(true);
    try {
      const existing = getAlert(cardId);
      if (existing) {
        await supabase.from('price_alerts').update({ target_price: parseFloat(alertPrice) }).eq('id', existing.id);
      } else {
        await supabase.from('price_alerts').insert({
          telegram_user_id: telegramUser.id,
          card_id: cardId,
          card_name: cardName,
          image_url: imageUrl,
          target_price: parseFloat(alertPrice),
          current_price: 0,
          triggered: false,
        });
      }
      await loadAlerts();
      setSettingAlert(null);
      setAlertPrice('');
    } finally {
      setSavingAlert(false);
    }
  };

  const removeAlert = async (cardId: string) => {
    const existing = getAlert(cardId);
    if (!existing) return;
    await supabase.from('price_alerts').delete().eq('id', existing.id);
    setAlerts(prev => prev.filter(a => a.id !== existing.id));
  };

  const sorted = [...items].sort((a, b) => {
    if (sort === 'name') return (a.cardName ?? '').localeCompare(b.cardName ?? '');
    return 0;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando wishlist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-gray-500">Cartas que quieres conseguir.</p>
      </div>

      {items.length > 0 && (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Busca en tu wishlist"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />

          <div className="flex gap-2 pb-1">
            {([
              { key: 'recent', label: 'Recientes' },
              { key: 'name', label: 'Nombre' },
            ] as { key: SortOption; label: string }[]).map(opt => (
              <button key={opt.key} onClick={() => setSort(opt.key)}
                className={'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + (
                  sort === opt.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 text-gray-400'
                )}>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {settingAlert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSettingAlert(null); setAlertPrice(''); }}>
          <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Alerta de precio</p>
              <button onClick={() => { setSettingAlert(null); setAlertPrice(''); }}
                className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
            </div>
            <p className="text-xs text-gray-400">Te avisaremos cuando el precio baje de tu objetivo.</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.01" value={alertPrice}
                onChange={e => setAlertPrice(e.target.value)}
                placeholder="Precio objetivo (€)"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              <button
                onClick={() => {
                  const item = items.find(i => i.cardId === settingAlert);
                  if (item) saveAlert(item.cardId ?? '', item.cardName ?? '', item.imageUrl ?? null);
                }}
                disabled={savingAlert || !alertPrice}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                {savingAlert ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Heart size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Tu wishlist está vacía</p>
            <p className="text-sm text-gray-500 mt-1">Añade cartas desde el Explorador.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(item => {
            const cardId = item.cardId ?? item.id;
            const cardName = item.cardName ?? '';
            const alert = getAlert(cardId);
            return (
              <div key={item.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
                <div className="relative">
                  <img src={item.imageUrl ?? ''} alt={cardName}
                    className="w-full aspect-[2/3] object-cover" loading="lazy" />
                  <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-pink-500/90 flex items-center justify-center">
                    <Heart size={12} className="fill-white text-white" />
                  </div>
                  {alert && (
                    <div className="absolute top-1.5 right-1.5 bg-yellow-500/90 rounded-full px-1.5 py-0.5">
                      <p className="text-[9px] font-bold text-black">€{alert.target_price}</p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 flex-1 space-y-1">
                  <p className="text-xs font-bold truncate text-white">{cardName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{item.setName}</p>
                  {item.rarity && <p className="text-[10px] text-blue-400 truncate">{item.rarity}</p>}
                  {alert && (
                    <p className="text-[10px] text-yellow-400">🔔 Alerta: €{alert.target_price}</p>
                  )}
                </div>

                <div className="px-2.5 pb-2.5 space-y-1.5">
                  <a href={'https://www.cardmarket.com/en/Pokemon/Products/Singles?searchString=' + encodeURIComponent(cardName)}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full py-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                    <ExternalLink size={11} />Cardmarket
                  </a>
                  <button
                    onClick={() => {
                      if (alert) {
                        removeAlert(cardId);
                      } else {
                        setSettingAlert(cardId);
                        setAlertPrice('');
                      }
                    }}
                    className={'w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 ' + (
                      alert
                        ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                        : 'bg-white/5 border border-white/10 text-gray-400'
                    )}>
                    {alert ? <><BellOff size={11} />Quitar alerta</> : <><Bell size={11} />Alerta de precio</>}
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    className="w-full py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center justify-center gap-1.5">
                    <Trash2 size={12} />Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}