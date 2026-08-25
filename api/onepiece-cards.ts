export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);

  try {
    // TCGdex - buscar sets de One Piece primero
    const setsUrl = 'https://api.tcgdex.net/v2/en/series/op/sets';
    const setsR = await fetch(setsUrl, { headers: { 'Accept': 'application/json' } });
    
    let targetSet = set as string;
    
    if (!targetSet) {
      // Sin filtro de set, buscar en OP01 por defecto o todos
      targetSet = 'op01';
    }

    const cardsUrl = `https://api.tcgdex.net/v2/en/sets/${targetSet.toLowerCase()}/cards`;
    const r = await fetch(cardsUrl, { headers: { 'Accept': 'application/json' } });

    if (!r.ok) return res.status(200).json({ cards: [], total: 0, error: `TCGdex ${r.status}` });

    const list: any[] = await r.json();

    const filtered = (Array.isArray(list) ? list : [])
      .filter((c: any) => !q || (c.name ?? '').toLowerCase().includes((q as string).toLowerCase()));

    const pageSize = 20;
    const start = (pageNum - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    // Obtener detalles de cada carta
    const cards = await Promise.all(paged.map(async (c: any) => {
      try {
        const detailR = await fetch(`https://api.tcgdex.net/v2/en/cards/${c.id}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (!detailR.ok) throw new Error('no detail');
        const detail: any = await detailR.json();
        return {
          id: detail.id ?? c.id,
          name: detail.name ?? c.name ?? '',
          number: detail.localId ?? c.localId ?? '',
          rarity: detail.rarity ?? '',
          type: detail.types?.[0] ?? '',
          color: detail.types ?? [],
          power: detail.hp ?? null,
          cost: null,
          image_url: detail.image ? `${detail.image}/high.webp` : `https://placehold.co/200x280/111118/666?text=${encodeURIComponent(c.name ?? 'OP')}`,
          set_id: targetSet,
          set_name: detail.set?.name ?? targetSet,
          price_eur: null,
        };
      } catch {
        return {
          id: c.id,
          name: c.name ?? '',
          number: c.localId ?? '',
          rarity: '',
          type: '',
          color: [],
          power: null,
          cost: null,
          image_url: c.image ? `${c.image}/high.webp` : `https://placehold.co/200x280/111118/666?text=OP`,
          set_id: targetSet,
          set_name: targetSet,
          price_eur: null,
        };
      }
    }));

    return res.status(200).json({ cards, total: filtered.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: String(err?.message ?? err) });
  }
}