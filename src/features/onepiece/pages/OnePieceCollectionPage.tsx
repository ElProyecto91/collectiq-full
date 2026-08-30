import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Minus, Plus, Trash2, ShoppingBag, Search, SlidersHorizontal, X, Layers, Package, CheckCircle2, AlertCircle, Loader2, Download, Upload, ZoomIn, Edit2, Globe, MapPin } from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useWishlist } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { RoutePaths } from '@/config';
import type { CollectionItem } from '@/types';

const API = 'https://collectiq-api.esxdinero.workers.dev';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸', priceLabel: 'TCGPlayer (EN)' },
  { code: 'jp', label: '日本語', flag: '🇯🇵', priceLabel: 'eBay JP' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', priceLabel: 'Cardmarket (FR)' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', priceLabel: 'Cardmarket (DE)' },
  { code: 'es', label: 'Español', flag: '🇪🇸', priceLabel: 'Cardmarket (ES)' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', priceLabel: 'Cardmarket (IT)' },
  { code: 'pt', label: 'Português', flag: '🇧🇷', priceLabel: 'eBay BR' },
];

const CONDITIONS = [
  { key: 'mint', label: 'Mint', color: 'text-green-400' },
  { key: 'near-mint', label: 'Near Mint', color: 'text-green-300' },
  { key: 'lightly-played', label: 'Lightly Played', color: 'text-yellow-400' },
  { key: 'moderately-played', label: 'Moderately Played', color: 'text-orange-400' },
  { key: 'heavily-played', label: 'Heavily Played', color: 'text-red-400' },
  { key: 'damaged', label: 'Damaged', color: 'text-red-600' },
];

const COLOR_MAP: Record<string, string> = { Red: '🔴', Blue: '🔵', Green: '🟢', Purple: '🟣', Black: '⚫', Yellow: '🟡' };

interface SetGroup { setId: string; setName: string; owned: number; total: number; cards: CollectionItem[]; totalValue: number; }

function exportToCSV(cards: CollectionItem[]) {
  const headers = ['Nombre','Set','Número','Rareza','Idioma','Condición','Cantidad','Precio mercado','Precio pagado','Notas','Imagen'];
  const rows = cards.map(c => [c.cardName??'',c.setName??'',c.cardNumber??'',c.rarity??'',(c as any).cardLanguage??'en',(c as any).condition??'',c.quantity,c.marketPrice??'',(c as any).purchasePrice??'',c.notes??'',c.imageUrl??'']);
  const csv = [headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='onepiece-collection.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function fetchPriceByRegion(card: CollectionItem, lang: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({ lang, name: card.cardName??'', number: card.cardNumber??'' });
    const r = await fetch(`${API}/onepiece-price?${params}`);
    const d = await r.json();
    return d.price ?? null;
  } catch { return null; }
}

function ZoomModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X size={20} className="text-white" /></button>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-xs">
        <img src={url} alt={name} className="w-full rounded-2xl shadow-2xl" />
        <p className="text-white text-center font-bold mt-3 text-sm">{name}</p>
      </div>
    </div>
  );
}

function EditModal({ card, onSave, onClose, onRefreshPrice }: { card: CollectionItem; onSave: (u: any) => void; onClose: () => void; onRefreshPrice: (c: CollectionItem, l: string) => Promise<number|null>; }) {
  const { formatPrice } = useCurrency();
  const [lang, setLang] = useState<string>((card as any).cardLanguage??'en');
  const [cond, setCond] = useState<string>((card as any).condition??'');
  const [buyPrice, setBuyPrice] = useState<string>((card as any).purchasePrice?.toString()??'');
  const [notes, setNotes] = useState<string>(card.notes??'');
  const [qty, setQty] = useState<number>(card.quantity??1);
  const [loc, setLoc] = useState<string>((card as any).storageLocation??'');
  const [refreshing, setRefreshing] = useState(false);
  const [price, setPrice] = useState<number|null>(card.marketPrice??null);
  const [step, setStep] = useState<'main'|'lang'|'cond'>('main');
  const currentLang = LANGUAGES.find(l=>l.code===lang)??LANGUAGES[0];
  const currentCond = CONDITIONS.find(c=>c.key===cond);
  const roi = buyPrice && price ? ((price-parseFloat(buyPrice))/parseFloat(buyPrice)*100) : null;

  const refreshPrice = async () => { setRefreshing(true); const p = await onRefreshPrice(card, lang); if (p!=null) setPrice(p); setRefreshing(false); };
  const save = () => onSave({ cardLanguage: lang, condition: cond, purchasePrice: buyPrice?parseFloat(buyPrice):null, notes: notes||null, quantity: qty, marketPrice: price, storageLocation: loc||null });

  if (step==='lang') return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-2 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold">Idioma / Región</p><button onClick={()=>setStep('main')} className="text-red-400 text-xs bg-red-500/10 px-3 py-1.5 rounded-lg">Volver</button></div>
        {LANGUAGES.map(l=>(
          <button key={l.code} onClick={()=>{setLang(l.code);setStep('main');}} className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left ${lang===l.code?'bg-red-500/10 border-red-500/30':'bg-white/5 border-white/8'}`}>
            <span className="text-xl">{l.flag}</span><div className="flex-1"><p className="text-sm font-medium text-white">{l.label}</p><p className="text-[10px] text-gray-500">{l.priceLabel}</p></div>
            {lang===l.code&&<span className="text-red-400">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );

  if (step==='cond') return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-2 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold">Condición</p><button onClick={()=>setStep('main')} className="text-red-400 text-xs bg-red-500/10 px-3 py-1.5 rounded-lg">Volver</button></div>
        <button onClick={()=>{setCond('');setStep('main');}} className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left ${!cond?'bg-red-500/10 border-red-500/30':'bg-white/5 border-white/8'}`}>
          <span className="text-xl">❓</span><p className="text-sm text-white font-medium">Sin especificar</p>{!cond&&<span className="ml-auto text-red-400">✓</span>}
        </button>
        {CONDITIONS.map(c=>(
          <button key={c.key} onClick={()=>{setCond(c.key);setStep('main');}} className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left ${cond===c.key?'bg-red-500/10 border-red-500/30':'bg-white/5 border-white/8'}`}>
            <div className={`w-3 h-3 rounded-full ${c.color.replace('text-','bg-')}`}/><p className={`text-sm font-medium ${c.color}`}>{c.label}</p>{cond===c.key&&<span className="ml-auto text-red-400">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-bold text-white">Editar carta</p><p className="text-xs text-gray-500 truncate max-w-[200px]">{card.cardName}</p></div>
          <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
        </div>
        {card.imageUrl && (
          <div className="flex gap-3 bg-white/5 rounded-2xl p-3">
            <img src={card.imageUrl} alt={card.cardName??''} className="w-14 rounded-xl object-cover shrink-0" style={{height:'4.5rem'}}/>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-gray-500">{card.cardNumber} · {card.setName}</p>
              {price!=null&&<p className="text-sm font-bold text-green-400">{formatPrice(price)}</p>}
              {roi!==null&&<p className={`text-[10px] font-medium ${roi>=0?'text-green-400':'text-red-400'}`}>ROI: {roi>=0?'+':''}{roi.toFixed(1)}%</p>}
              <button onClick={refreshPrice} disabled={refreshing} className="text-[10px] text-blue-400 flex items-center gap-1 disabled:opacity-50">
                {refreshing?<Loader2 size={10} className="animate-spin"/>:<Globe size={10}/>} Actualizar precio ({currentLang.priceLabel})
              </button>
            </div>
          </div>
        )}
        <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">Cantidad</p>
          <div className="flex items-center gap-3">
            <button onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Minus size={14} className="text-white"/></button>
            <span className="text-xl font-bold text-white min-w-[2rem] text-center">{qty}</span>
            <button onClick={()=>setQty(q=>q+1)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Plus size={14} className="text-white"/></button>
          </div>
        </div>
        <button onClick={()=>setStep('lang')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
          <span className="text-xl">{currentLang.flag}</span><div className="flex-1"><p className="text-xs text-gray-500">Idioma / Región</p><p className="text-sm font-medium text-white">{currentLang.label}</p></div><span className="text-gray-500 text-xs">›</span>
        </button>
        <button onClick={()=>setStep('cond')} className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-left">
          <span className="text-xl">🔍</span><div className="flex-1"><p className="text-xs text-gray-500">Condición</p><p className={`text-sm font-medium ${currentCond?.color??'text-gray-400'}`}>{currentCond?.label??'Sin especificar'}</p></div><span className="text-gray-500 text-xs">›</span>
        </button>
        <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-gray-500">Precio pagado</p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} placeholder="0.00" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"/>
            <span className="text-xs text-gray-500">EUR</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin size={11}/>Ubicación</p>
          <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Ej: Álbum 1, página 3..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"/>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Notas</p>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Estado, historial..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none resize-none h-16"/>
        </div>
        <button onClick={save} className="w-full bg-red-600 text-white rounded-xl py-3 font-semibold active:scale-95 transition-transform">Guardar cambios</button>
      </div>
    </div>
  );
}

function MarketModal({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s=>s.telegramUser);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between"><p className="text-sm font-bold">Vender en Marketplace</p><button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button></div>
        <div className="flex gap-3 bg-white/5 rounded-xl p-3">
          {card.imageUrl&&<img src={card.imageUrl} alt={card.cardName??''} className="w-12 h-16 object-cover rounded-lg shrink-0"/>}
          <div><p className="text-sm font-bold">{card.cardName}</p><p className="text-xs text-gray-400">{card.setName}</p>{card.marketPrice&&<p className="text-sm font-bold text-green-400 mt-1">€{card.marketPrice.toFixed(2)}</p>}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{type:'sell',label:'💚 Vender',color:'bg-green-500/15 border-green-500/25 text-green-400'},{type:'trade',label:'🔄 Cambiar',color:'bg-blue-500/15 border-blue-500/25 text-blue-400'},{type:'want',label:'🔍 Buscar',color:'bg-purple-500/15 border-purple-500/25 text-purple-400'}].map(opt=>(
            <button key={opt.type} onClick={()=>{navigate(RoutePaths.Marketplace,{state:{prefill:{listing_type:opt.type,tcg:'onepiece',item_name:card.cardName||'',set_name:card.setName||'',card_number:card.cardNumber||'',image_url:card.imageUrl||'',price:card.marketPrice?card.marketPrice.toFixed(2):'',contact_telegram:telegramUser?.username||''},tab:'create'}});onClose();}} className={`py-2.5 rounded-xl text-xs font-semibold border active:scale-95 ${opt.color}`}>{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SetPanel({ group, onAddWishlist, onZoom }: { group: SetGroup; onAddWishlist: (cards: any[]) => void; onZoom: (url: string, name: string) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<any[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const { formatPrice } = useCurrency();
  const pct = catalogTotal>0?Math.round((group.cards.length/catalogTotal)*100):0;
  const missingCount = catalogTotal>0?catalogTotal-group.cards.length:0;

  const loadMissing = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Cargar todas las cartas del set paginando
      const allSetCards: any[] = [];
      let page = 1;
      while (true) {
        const r = await fetch(`${API}/onepiece-cards?set=${encodeURIComponent(group.setId)}&limit=50&page=${page}`);
        if (!r.ok) break;
        const d = await r.json();
        const batch = d.cards || [];
        allSetCards.push(...batch);
        if (batch.length < 50 || allSetCards.length >= (d.total || 9999)) break;
        page++;
      }
      setCatalogTotal(allSetCards.length);
      const ownedIds = new Set(
        group.cards.flatMap((c:any) => [c.cardId, c.cardNumber, c.card_number].filter(Boolean))
      );
      const missingCards = allSetCards.filter((c:any) =>
        !ownedIds.has(c.id) && !ownedIds.has(c.number)
      );
      setMissing(missingCards);
    } catch(e) {}
    setLoading(false);
  };

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
      <button onClick={()=>{const next=!expanded;setExpanded(next);if(next&&missing.length===0)loadMissing();}} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0"><p className="text-sm font-bold text-white truncate">{group.setName||group.setId}</p><p className="text-xs text-gray-500 mt-0.5">{group.cards.length}{group.total>0?`/${group.total}`:''} únicas · {group.owned} total</p></div>
          <div className="text-right shrink-0">{pct===100&&<span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium block mb-1">✓ Completo</span>}{group.totalValue>0&&<p className="text-xs text-green-400 font-bold">{formatPrice(group.totalValue)}</p>}</div>
        </div>
        {group.total>0&&<div className="w-full bg-white/8 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${pct===100?'bg-green-500':'bg-gradient-to-r from-red-600 to-orange-500'}`} style={{width:`${pct}%`}}/></div>}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {group.cards.slice(0,6).map(c=><img key={c.id} src={c.imageUrl??''} alt={c.cardName??''} className="h-12 w-8 object-cover rounded-lg shrink-0"/>)}
          {group.cards.length>6&&<div className="h-12 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><span className="text-[9px] text-gray-400">+{group.cards.length-6}</span></div>}
        </div>
      </button>
      {expanded&&(
        <div className="border-t border-white/8 p-4 space-y-3">
          <p className="text-xs font-bold text-green-400 flex items-center gap-1.5"><CheckCircle2 size={12}/> Tienes ({group.cards.length})</p>
          <div className="grid grid-cols-4 gap-1.5">
            {group.cards.map(c=>(
              <div key={c.id} className="relative cursor-pointer" onClick={()=>c.imageUrl&&onZoom(c.imageUrl,c.cardName??'')}>
                <img src={c.imageUrl??''} alt={c.cardName??''} className="w-full aspect-[3/4] object-cover rounded-lg"/>
                {c.quantity>1&&<span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] font-bold px-1 rounded">x{c.quantity}</span>}
              </div>
            ))}
          </div>
          {missingCount>0&&(
            <>
              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5 mt-2"><AlertCircle size={12}/> Faltan ({missingCount})</p>
              {loading?<div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-500"/></div>:missing.length>0?(
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {missing.slice(0,16).map((c:any)=>(
                      <div key={c.id} className="relative cursor-pointer opacity-50" onClick={()=>c.image_url&&onZoom(c.image_url,c.name)}>
                        <img src={c.image_url} alt={c.name} className="w-full aspect-[3/4] object-cover rounded-lg grayscale"/>
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40"><X size={12} className="text-red-400"/></div>
                      </div>
                    ))}
                    {missing.length>16&&<div className="aspect-[3/4] rounded-lg bg-white/5 flex items-center justify-center"><span className="text-[9px] text-gray-400 text-center">+{missing.length-16}<br/>más</span></div>}
                  </div>
                  <button onClick={()=>onAddWishlist(missing)} className="w-full py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95">
                    <Heart size={12}/> Añadir {missing.length} a Wishlist
                  </button>
                </>
              ):null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function OnePieceCollectionPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { items: cards, updateItem, removeItem } = useCollection('onepiece');
  const { addItem: addToWishlist } = useWishlist('onepiece');

  const [view, setView] = useState<'cards'|'sets'>('cards');
  const [search, setSearch] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [marketCard, setMarketCard] = useState<CollectionItem|null>(null);
  const [editCard, setEditCard] = useState<CollectionItem|null>(null);
  const [zoomedImg, setZoomedImg] = useState<{url:string;name:string}|null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = (msg: string) => { setStatusMsg(msg); setTimeout(()=>setStatusMsg(''),2500); };

  const filtered = cards.filter(c=>(!search||(c.cardName??'').toLowerCase().includes(search.toLowerCase()))&&(!filterRarity||c.rarity===filterRarity));
  const rarities = [...new Set(cards.map(c=>c.rarity??'').filter(Boolean))].sort();
  const totalValue = cards.reduce((s,c)=>s+(c.marketPrice??0)*c.quantity,0);
  const totalCards = cards.reduce((s,c)=>s+c.quantity,0);
  const activeFilters = [filterRarity].filter(Boolean).length;

  const setGroups: SetGroup[] = Object.values(
    cards.reduce((acc,c)=>{
      const numKeyRaw = c.cardNumber?.match(/^([A-Z]+)(\d+)-/i);
      // Normalizar: OP01 → OP-01, EB01 → EB-01, ST01 → ST-01
      const numKey = numKeyRaw ? (numKeyRaw[1].toUpperCase() + '-' + numKeyRaw[2]) : null;
      const key = numKey || c.setName || 'Sin set';
      if(!acc[key]) acc[key]={setId:key,setName:c.setName||key,owned:0,total:0,cards:[],totalValue:0};
      acc[key].owned+=c.quantity; acc[key].cards.push(c); acc[key].totalValue+=(c.marketPrice??0)*c.quantity;
      return acc;
    },{}as Record<string,SetGroup>)
  ).sort((a,b)=>b.owned-a.owned);

  const handleAddMissingToWishlist = async (missingCards: any[]) => {
    let added = 0;
    for (const card of missingCards.slice(0,50)) {
      try { await addToWishlist({tcg:'onepiece',card_id:card.id,card_name:card.name,set_name:card.set_name,card_number:card.number,rarity:card.rarity,image_url:card.image_url}as any); added++; } catch {}
    }
    showStatus(`❤️ ${added} cartas añadidas a wishlist`);
  };

  const handleImport = async (rows: any[]) => {
    let imported = 0;
    for (const row of rows) { if (row['nombre']||row['name']) imported++; }
    showStatus(`📥 ${imported} cartas detectadas`);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
      const rows = lines.slice(1).map(line=>{const vals=line.split(',').map(v=>v.replace(/^"|"$/g,'').trim());const obj:any={};headers.forEach((h,i)=>{obj[h]=vals[i]??'';});return obj;}).filter(c=>c['nombre']||c['name']);
      handleImport(rows);
    };
    reader.readAsText(file); e.target.value='';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {marketCard&&<MarketModal card={marketCard} onClose={()=>setMarketCard(null)}/>}
      {editCard&&<EditModal card={editCard} onSave={u=>{updateItem(editCard.id,u as any);setEditCard(null);showStatus('✅ Carta actualizada');}} onClose={()=>setEditCard(null)} onRefreshPrice={fetchPriceByRegion}/>}
      {zoomedImg&&<ZoomModal url={zoomedImg.url} name={zoomedImg.name} onClose={()=>setZoomedImg(null)}/>}

      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/25 to-transparent pointer-events-none"/>
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={()=>navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><ArrowLeft size={16}/></button>
          <div><p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p><h1 className="text-lg font-bold">Mi Colección</h1></div>
          <div className="ml-auto flex gap-2">
            <label className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 cursor-pointer active:scale-95">
              <Upload size={16}/><input type="file" accept=".csv" onChange={handleFileImport} className="hidden"/>
            </label>
            {cards.length>0&&<button onClick={()=>{exportToCSV(cards);showStatus('📤 CSV exportado');}} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 active:scale-95"><Download size={16}/></button>}
          </div>
        </div>
      </div>

      {statusMsg&&<div className="mx-4 mb-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white text-center">{statusMsg}</div>}

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center"><p className="text-xl font-bold text-red-400">{totalCards}</p><p className="text-[10px] text-gray-500">Cartas</p></div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center"><p className="text-xl font-bold text-purple-400">{cards.length}</p><p className="text-[10px] text-gray-500">Únicas</p></div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center"><p className="text-xl font-bold text-green-400">{formatPrice(totalValue)}</p><p className="text-[10px] text-gray-500">Valor</p></div>
        </div>

        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={()=>setView('cards')} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${view==='cards'?'bg-red-600 text-white':'text-gray-400'}`}><Layers size={12}/> Cartas</button>
          <button onClick={()=>setView('sets')} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${view==='sets'?'bg-red-600 text-white':'text-gray-400'}`}><Package size={12}/> Sets ({setGroups.length})</button>
        </div>

        {view==='sets'&&(
          <div className="space-y-3">
            {setGroups.length===0?(
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="text-5xl">☠️</div>
                <p className="text-white font-bold">Sin cartas todavía</p>
                <button onClick={()=>navigate('/onepiece/explorer')} className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">Explorar cartas</button>
              </div>
            ):setGroups.map(group=><SetPanel key={group.setId} group={group} onAddWishlist={handleAddMissingToWishlist} onZoom={(url,name)=>setZoomedImg({url,name})}/>)}
          </div>
        )}

        {view==='cards'&&(
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar en tu colección..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none"/>
              </div>
              <button onClick={()=>setShowFilters(!showFilters)} className={`relative w-12 rounded-2xl border flex items-center justify-center ${showFilters||activeFilters>0?'bg-red-600/20 border-red-500/30 text-red-400':'bg-white/5 border-white/10 text-gray-400'}`}>
                <SlidersHorizontal size={16}/>
                {activeFilters>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilters}</span>}
              </button>
            </div>

            {showFilters&&rarities.length>0&&(
              <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between"><p className="text-xs font-bold">Rareza</p>{filterRarity&&<button onClick={()=>setFilterRarity('')} className="text-xs text-red-400 flex items-center gap-1"><X size={11}/>Limpiar</button>}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {rarities.map(r=><button key={r} onClick={()=>setFilterRarity(filterRarity===r?'':r)} className={`px-2.5 py-1 rounded-full text-[10px] border ${filterRarity===r?'bg-yellow-500/20 text-yellow-400 border-yellow-500/30':'bg-white/5 border-white/10 text-gray-400'}`}>{r}</button>)}
                </div>
              </div>
            )}

            {cards.length===0?(
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="text-5xl">☠️</div>
                <p className="text-white font-bold">Sin cartas todavía</p>
                <button onClick={()=>navigate('/onepiece/explorer')} className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">Explorar cartas</button>
              </div>
            ):filtered.length===0?<p className="text-center text-gray-500 text-sm py-8">Sin resultados</p>:(
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(card=>{
                  const lang = LANGUAGES.find(l=>l.code===((card as any).cardLanguage??'en'))??LANGUAGES[0];
                  const cond = CONDITIONS.find(c=>c.key===(card as any).condition);
                  const purchasePrice = (card as any).purchasePrice;
                  const roi = purchasePrice&&card.marketPrice?((card.marketPrice-purchasePrice)/purchasePrice*100):null;
                  return (
                    <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                      <div className="relative cursor-pointer" onClick={()=>card.imageUrl&&setZoomedImg({url:card.imageUrl,name:card.cardName??''})}>
                        <img src={card.imageUrl??''} alt={card.cardName??''} className="w-full aspect-[3/4] object-cover" loading="lazy" onError={e=>{(e.target as HTMLImageElement).src='https://placehold.co/200x280/111118/666?text=OP';}}/>
                        <button onClick={e=>{e.stopPropagation();updateItem(card.id,{favorite:!card.favorite}as any);}} className="absolute right-1.5 top-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                          <Heart size={13} className={card.favorite?'fill-yellow-400 text-yellow-400':'text-gray-400'}/>
                        </button>
                        <div className="absolute bottom-1.5 left-1.5"><span className="text-sm bg-black/60 rounded-full px-1.5 py-0.5">{lang.flag}</span></div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 active:opacity-100 bg-black/20 transition-opacity rounded-t-2xl"><ZoomIn size={20} className="text-white"/></div>
                      </div>
                      <div className="p-2.5 space-y-0.5">
                        <p className="text-xs font-bold truncate">{card.cardName}</p>
                        <p className="text-[10px] text-gray-500 truncate">{card.cardNumber}</p>
                        {card.rarity&&<p className="text-[10px] text-yellow-400">{card.rarity}</p>}
                        {cond&&<p className={`text-[10px] font-medium ${cond.color}`}>{cond.label}</p>}
                        {card.marketPrice!=null&&<p className="text-[10px] text-green-400 font-medium">{formatPrice(card.marketPrice)}</p>}
                        {roi!==null&&<p className={`text-[10px] font-medium ${roi>=0?'text-green-400':'text-red-400'}`}>ROI: {roi>=0?'+':''}{roi.toFixed(1)}%</p>}
                      </div>
                      <div className="px-2.5 pb-2.5 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={()=>card.quantity>1&&updateItem(card.id,{quantity:card.quantity-1}as any)} disabled={card.quantity<=1} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center disabled:opacity-40"><Minus size={11} className="text-gray-400"/></button>
                          <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">{card.quantity}</span>
                          <button onClick={()=>updateItem(card.id,{quantity:card.quantity+1}as any)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"><Plus size={11} className="text-gray-400"/></button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <button onClick={()=>setEditCard(card)} className="h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-blue-400 active:scale-95"><Edit2 size={11}/></button>
                          <button onClick={()=>setMarketCard(card)} className="h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-green-400 active:scale-95"><ShoppingBag size={11}/></button>
                          <button onClick={()=>removeItem(card.id)} className="h-7 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 active:scale-95"><Trash2 size={11}/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
