import { Heart, Layers, Minus, Plus, Trash2, Star, LayoutGrid, Package } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useCollectionList, useUpdateCollectionItem, useDeleteCollectionItem } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import type { CollectionItem } from '@/types';

type SortOption = 'recent' | 'name' | 'value';
type ViewMode = 'cards' | 'sets';

interface SetCompletion {
  setName: string;
  owned: number;
  total: number;
  cards: CollectionItem[];
}

export function CollectionPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');
  const [view, setView] = useState<ViewMode>('cards');

  const { data: cards = [], isLoading } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: updateItem } = useUpdateCollectionItem();
  const { mutate: deleteItem } = useDeleteCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { formatPrice } = useCurrency();

  const updateEntry = useCallback((id: string, update: Partial<CollectionItem>) => {
    updateItem({ id, update });
  }, [updateItem]);

  const removeEntry = useCallback((id: string) => {
    deleteItem(id);
  }, [deleteItem]);

  const setGroups: SetCompletion[] = Object.values(
    cards.reduce((acc, card) => {
      const key = card.setName;
      if (!acc[key]) acc[key] = { setName: key, owned: 0, total: card.setTotal ?? 0, cards: [] };
      acc[key].owned += card.quantity;
      acc[key].cards.push(card);
      return acc;
    }, {} as Record<string, SetCompletion>)
  ).sort((a, b) => b.owned - a.owned);

  const wishlistCardIds = new Set(wishlistItems.map(w => w.cardId));

  const filtered = [...cards]
    .filter(c => c.cardName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'name') return a.cardName.localeCompare(b.cardName);
      if (sort === 'value') {
        const va = a.marketPrice ?? a.tcgplayerPrice ?? 0;
        const vb = b.marketPrice ?? b.tcgplayerPrice ?? 0;
        return vb - va;
      }
      return 0;
    });

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const favorites = cards.filter(c => c.favorite).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando colección...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      <div>
        <h1 className="text-2xl font-bold text-white">Colección</h1>
        <p className="text-sm text-gray-500">Todas tus cartas, en un solo lugar.</p>
      </div>

      {totalCards > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cartas', value: totalCards, color: 'text-blue-400' },
            { label: 'Únicas', value: uniqueCards, color: 'text-purple-400' },
            { label: 'Favoritas', value: favorites, color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setView('cards')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            <LayoutGrid size={13} />
            Cartas
          </button>
          <button
            onClick={() => setView('sets')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              view === 'sets' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            <Package size={13} />
            Sets
          </button>
        </div>
      )}

      {view === 'cards' && (
        <>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Busca en tu colección"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-gray-500">Ordenar</span>
            {(['recent', 'name', 'value'] as SortOption[]).map(opt => (
              <button
                key={opt}
                onClick={() => setSort(opt)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sort === opt ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'
                }`}
              >
                {opt === 'recent' ? 'Recientes' : opt === 'name' ? 'Nombre' : 'Valor'}
              </button>
            ))}
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Layers size={28} className="text-gray-600" />
              </div>
              <div>
                <p className="text-white font-semibold">Aún no tienes cartas</p>
                <p className="text-sm text-gray-500 mt-1">Escanea cartas para empezar tu colección.</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No hay cartas que coincidan con "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(card => (
                <CollectionCard
                  key={card.id}
                  card={card}
                  onUpdate={updateEntry}
                  onRemove={removeEntry}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'sets' && (
        <div className="space-y-3">
          {setGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Package size={28} className="text-gray-600" />
              </div>
              <p className="text-white font-semibold">Sin sets todavía</p>
            </div>
          ) : (
            setGroups.map(group => {
              const total = group.total;
              const pct = total > 0 ? Math.round((group.cards.length / total) * 100) : 0;
              const missing = total - group.cards.length;

              return (
                <div key={group.setName} className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{group.setName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {group.cards.length}/{total > 0 ? total : '?'} cartas
                        {pct > 0 && <span className="text-blue-400 ml-1">· {pct}%</span>}
                      </p>
                    </div>
                    {pct === 100 && (
                      <span className="shrink-0 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                        ✓ Completo
                      </span>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-blue-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group.cards.slice(0, 5).map(card => (
                      <img
                        key={card.id}
                        src={card.imageUrl ?? ''}
                        alt={card.cardName}
                        className="h-14 w-10 object-cover rounded-lg shrink-0"
                      />
                    ))}
                    {group.cards.length > 5 && (
                      <div className="h-14 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-gray-400">+{group.cards.length - 5}</span>
                      </div>
                    )}
                  </div>

                  {missing > 0 && total > 0 && telegramUser?.id && (
                    <button
                      onClick={async () => {
                        const res = await fetch(
                          `https://api.pokemontcg.io/v2/cards?q=set.name:"${encodeURIComponent(group.setName)}"&pageSize=250`
                        );
                        const json = await res.json();
                        const ownedIds = new Set(group.cards.map(c => c.cardId));
                        const missingCards = (json.data ?? []).filter((c: any) => !ownedIds.has(c.id) && !wishlistCardIds.has(c.id));
                        missingCards.forEach((c: any) => {
                          createWishlistItem({
                            cardId: c.id,
                            tcg: 'pokemon',
                            telegramUserId: telegramUser.id,
                            cardName: c.name,
                            setName: c.set.name,
                            cardNumber: c.number,
                            rarity: c.rarity ?? null,
                            imageUrl: c.images?.small ?? null,
                            setTotal: c.set?.total ?? null,
                          } as any);
                        });
                      }}
                      className="w-full py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-1.5"
                    >
                      <Heart size={12} />
                      Añadir {missing} que faltan a Wishlist
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CollectionCard({
  card,
  onUpdate,
  onRemove,
  formatPrice,
}: {
  card: CollectionItem;
  onUpdate: (id: string, update: Partial<CollectionItem>) => void;
  onRemove: (id: string) => void;
  formatPrice: (price: number | null | undefined) => string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onRemove(card.id);
  };

  const price = card.marketPrice ?? card.tcgplayerPrice ?? null;

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      <div className="relative">
        <img
          src={card.imageUrl ?? ''}
          alt={card.cardName}
          className="w-full aspect-[2/3] object-cover"
          loading="lazy"
        />
        <button
          onClick={() => onUpdate(card.id, { favorite: !card.favorite })}
          className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <Heart
            size={15}
            className={card.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
          />
        </button>
        {card.favorite && (
          <div className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-yellow-400/90 flex items-center justify-center">
            <Star size={12} className="fill-black text-black" />
          </div>
        )}
      </div>

      <div className="p-2.5 flex-1 space-y-1">
        <p className="text-xs font-bold truncate text-white">{card.cardName}</p>
        <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
        {card.rarity && <p className="text-[10px] text-blue-400 truncate">{card.rarity}</p>}
        {price && <p className="text-[10px] text-green-400 font-medium">{formatPrice(price)}</p>}
      </div>

      <div className="flex items-center justify-between gap-1 px-2.5 pb-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => card.quantity > 1 && onUpdate(card.id, { quantity: card.quantity - 1 })}
            disabled={card.quantity <= 1}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-40"
          >
            <Minus size={13} />
          </button>
          <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">
            {card.quantity}
          </span>
          <button
            onClick={() => onUpdate(card.id, { quantity: card.quantity + 1 })}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400"
          >
            <Plus size={13} />
          </button>
        </div>
        <button
          onClick={handleRemove}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
            confirmDelete
              ? 'border-red-500 bg-red-500/10 text-red-400'
              : 'border-white/10 bg-white/5 text-gray-500'
          }`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}