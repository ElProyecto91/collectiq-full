import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  images: { small: string };
  set: { name: string };
  supertype: string;
}

const POKEMON_API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY ?? '';

export function CreateDeckPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);

  const [step, setStep] = useState<'info' | 'cards'>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deckCards, setDeckCards] = useState<Map<string, { card: PokemonCard; quantity: number }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  const totalCards = Array.from(deckCards.values()).reduce((s, c) => s + c.quantity, 0);

  const searchCards = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(
        'https://api.pokemontcg.io/v2/cards?q=name:"*' + q + '*"&pageSize=8&orderBy=-set.releaseDate',
        { headers: { 'X-Api-Key': POKEMON_API_KEY } }
      );
      const json = await res.json();
      setSearchResults(json.data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addCard = (card: PokemonCard) => {
    const existing = deckCards.get(card.id);
    const qty = existing?.quantity ?? 0;
    if (qty >= 4) return;
    const newMap = new Map(deckCards);
    newMap.set(card.id, { card, quantity: qty + 1 });
    setDeckCards(newMap);
  };

  const removeCard = (cardId: string) => {
    const existing = deckCards.get(cardId);
    if (!existing) return;
    const newMap = new Map(deckCards);
    if (existing.quantity <= 1) {
      newMap.delete(cardId);
    } else {
      newMap.set(cardId, { ...existing, quantity: existing.quantity - 1 });
    }
    setDeckCards(newMap);
  };

  const handleSave = async () => {
    if (!telegramUser?.id || !name.trim()) return;
    setIsSaving(true);
    try {
      const coverImage = Array.from(deckCards.values())[0]?.card.images.small ?? null;

      const { data: deck, error } = await supabase
        .from('decks')
        .insert({
          telegram_user_id: telegramUser.id,
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          cover_card_image: coverImage,
        })
        .select('id')
        .single();

      if (error || !deck) throw error;

      const cardRows = Array.from(deckCards.values()).map(({ card, quantity }) => ({
        deck_id: deck.id,
        card_id: card.id,
        card_name: card.name,
        card_number: card.number,
        set_name: card.set.name,
        image_url: card.images.small,
        quantity,
      }));

      await supabase.from('deck_cards').insert(cardRows);
      navigate('/decks');
    } catch {
      alert('Error al guardar el mazo');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => step === 'cards' ? setStep('info') : navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">{step === 'info' ? 'Nuevo mazo' : 'Añadir cartas'}</h1>
        </div>
        {step === 'cards' && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Cartas</p>
            <p className={'text-sm font-bold ' + (totalCards === 60 ? 'text-green-400' : totalCards > 60 ? 'text-red-400' : 'text-white')}>
              {totalCards}/60
            </p>
          </div>
        )}
      </div>

      {step === 'info' && (
        <div className="px-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Nombre del mazo *</p>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="ej: Charizard ex Control"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Descripcion</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Estrategia, combos principales..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none h-24" />
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ' + (isPublic ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
            <div className="text-left">
              <p className="text-sm font-medium text-white">{isPublic ? 'Mazo publico' : 'Mazo privado'}</p>
              <p className="text-xs text-gray-500">{isPublic ? 'Visible en la Comunidad' : 'Solo tu puedes verlo'}</p>
            </div>
            <div className={'w-5 h-5 rounded-full border-2 flex items-center justify-center ' + (isPublic ? 'border-blue-400 bg-blue-400' : 'border-gray-600')}>
              {isPublic && <span className="text-[10px] text-white font-bold">✓</span>}
            </div>
          </button>
          <button onClick={() => { if (name.trim()) setStep('cards'); }}
            disabled={!name.trim()}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40 active:scale-95 transition-transform">
            Siguiente — Añadir cartas
          </button>
        </div>
      )}

      {step === 'cards' && (
        <div className="px-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query}
              onChange={e => { setQuery(e.target.value); searchCards(e.target.value); }}
              placeholder="Buscar cartas..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {searchResults.map(card => {
                const qty = deckCards.get(card.id)?.quantity ?? 0;
                return (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-xl overflow-hidden">
                    <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" />
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                      <div className="flex items-center justify-between">
                        <button onClick={() => removeCard(card.id)} disabled={qty === 0}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-30">
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-bold">{qty}</span>
                        <button onClick={() => addCard(card)} disabled={qty >= 4}
                          className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white disabled:opacity-30">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {deckCards.size > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">En el mazo ({totalCards}/60)</p>
              {Array.from(deckCards.values()).map(({ card, quantity }) => (
                <div key={card.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                  <img src={card.images.small} alt={card.name} className="w-8 h-11 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{card.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeCard(card.id)}
                      className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400">
                      <Minus size={11} />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{quantity}</span>
                    <button onClick={() => addCard(card)} disabled={quantity >= 4}
                      className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white disabled:opacity-30">
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} disabled={isSaving || totalCards === 0}
            className={'w-full rounded-xl py-3 font-semibold active:scale-95 transition-transform disabled:opacity-40 ' + (totalCards === 60 ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')}>
            {isSaving ? 'Guardando...' : totalCards === 60 ? 'Guardar mazo (60/60)' : 'Guardar mazo (' + totalCards + '/60)'}
          </button>
        </div>
      )}
    </div>
  );
}