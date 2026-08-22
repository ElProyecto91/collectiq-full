import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface CollectionItem {
  id: string;
  funko_id: string;
  custom_name: string | null;
  quantity: number;
  condition: string;
  box_condition: string;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  market_value: number | null;
  location: string | null;
  notes: string | null;
  is_for_sale: boolean;
  is_for_trade: boolean;
  folder: string | null;
  funko_items: { name: string; franchise: string | null } | null;
}

const CONDITIONS = ['mint', 'near_mint', 'good', 'damaged'];
const BOX_CONDITIONS = ['mint', 'near_mint', 'good', 'damaged', 'no_box'];
const FOLDERS = ['Mi colección', 'Grails', 'Para vender', 'Para intercambiar', 'Marvel', 'Disney', 'Star Wars', 'Anime', 'Convention'];

export function FunkoEditItemPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [item, setItem] = useState<CollectionItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Form state
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('mint');
  const [boxCondition, setBoxCondition] = useState('mint');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseSource, setPurchaseSource] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isForSale, setIsForSale] = useState(false);
  const [isForTrade, setIsForTrade] = useState(false);
  const [folder, setFolder] = useState('');
  const [customFolder, setCustomFolder] = useState('');

  useEffect(() => {
    if (!id) return;
    loadItem();
  }, [id]);

  const loadItem = async () => {
    const { data } = await supabase
      .from('funko_collection')
      .select('*, funko_items(name, franchise)')
      .eq('id', id)
      .single();
    if (data) {
      setItem(data as any);
      setQuantity(data.quantity.toString());
      setCondition(data.condition ?? 'mint');
      setBoxCondition(data.box_condition ?? 'mint');
      setPurchasePrice(data.purchase_price?.toString() ?? '');
      setPurchaseDate(data.purchase_date ?? '');
      setPurchaseSource(data.purchase_source ?? '');
      setLocation(data.location ?? '');
      setNotes(data.notes ?? '');
      setIsForSale(data.is_for_sale ?? false);
      setIsForTrade(data.is_for_trade ?? false);
      setFolder(data.folder ?? '');
    }
    setIsLoading(false);
  };

  const save = async () => {
    if (!id) return;
    setIsSaving(true);
    const finalFolder = customFolder || folder;
    const { error } = await supabase.from('funko_collection').update({
      quantity: parseInt(quantity) || 1,
      condition,
      box_condition: boxCondition,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
      purchase_date: purchaseDate || null,
      purchase_source: purchaseSource || null,
      location: location || null,
      notes: notes || null,
      is_for_sale: isForSale,
      is_for_trade: isForTrade,
      folder: finalFolder || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (!error) {
      setStatusMsg('✅ Guardado');
      setTimeout(() => navigate(-1), 1000);
    } else {
      setStatusMsg('❌ Error al guardar');
    }
    setIsSaving(false);
  };

  const deleteItem = async () => {
    if (!id) return;
    await supabase.from('funko_collection').delete().eq('id', id);
    navigate(-1);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">Cargando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold truncate">{item?.funko_items?.name ?? 'Editar Funko'}</h1>
        </div>
        <button onClick={deleteItem}
          className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        {/* Cantidad */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cantidad</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(q => Math.max(1, parseInt(q) - 1).toString())}
              className="w-10 h-10 rounded-xl bg-white/5 text-white font-bold text-lg">−</button>
            <span className="text-2xl font-bold text-white w-12 text-center">{quantity}</span>
            <button onClick={() => setQuantity(q => (parseInt(q) + 1).toString())}
              className="w-10 h-10 rounded-xl bg-white/5 text-white font-bold text-lg">+</button>
          </div>
        </div>

        {/* Condición */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Condición figura</p>
          <div className="grid grid-cols-2 gap-2">
            {CONDITIONS.map(c => (
              <button key={c} onClick={() => setCondition(c)}
                className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  condition === c ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'
                }`}>
                {c.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Condición caja */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Condición caja</p>
          <div className="grid grid-cols-2 gap-2">
            {BOX_CONDITIONS.map(c => (
              <button key={c} onClick={() => setBoxCondition(c)}
                className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  boxCondition === c ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'
                }`}>
                {c.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Compra */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Información de compra</p>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Precio pagado (€)</p>
              <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                type="number" placeholder="0.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Fecha de compra</p>
              <input value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                type="date"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Tienda / Fuente</p>
              <input value={purchaseSource} onChange={e => setPurchaseSource(e.target.value)}
                placeholder="Amazon, tienda local..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50" />
            </div>
          </div>
        </div>

        {/* Carpeta */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Carpeta</p>
          <div className="flex flex-wrap gap-2">
            {FOLDERS.map(f => (
              <button key={f} onClick={() => { setFolder(f); setCustomFolder(''); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  folder === f && !customFolder ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
                }`}>
                {f}
              </button>
            ))}
          </div>
          <input value={customFolder} onChange={e => { setCustomFolder(e.target.value); setFolder(''); }}
            placeholder="O escribe una carpeta personalizada..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50" />
        </div>

        {/* Venta / Intercambio */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Disponibilidad</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIsForSale(p => !p)}
              className={`py-3 rounded-xl text-sm font-bold transition-all ${
                isForSale ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400'
              }`}>
              💰 {isForSale ? 'En venta ✓' : 'En venta'}
            </button>
            <button onClick={() => setIsForTrade(p => !p)}
              className={`py-3 rounded-xl text-sm font-bold transition-all ${
                isForTrade ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'
              }`}>
              🔄 {isForTrade ? 'Intercambio ✓' : 'Intercambio'}
            </button>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ubicación física</p>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Estantería 1, Caja A..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50" />
        </div>

        {/* Notas */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Notas</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notas adicionales..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 resize-none" />
        </div>

        {/* Guardar */}
        <button onClick={save} disabled={isSaving}
          className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
          <Save className="w-4 h-4" />
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}