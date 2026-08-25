// api/onepiece-cards.ts
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const pageSize = 20;

  try {
    // Usar TCGdex - API pública sin auth
    const baseUrl = 'https://api.tcgdex.net/v2/en/cards';
    const r = await fetch(baseUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!r.ok) {
      return res.status(200).json({ cards: [], total: 0, error: `API returned ${r.status}` });
    }

    const data = await r.json();
    const allCards: any[] = Array.isArray(data) ? data : [];

    // Filtrar por nombre y set
    const filtered = allCards.filter((c: any) => {
      const matchesQ = !q || (c.name ?? '').toLowerCase().includes((q as string).toLowerCase());
      const matchesSet = !set || (c.set?.id ?? '').toUpperCase().startsWith((set as string).toUpperCase());
      return matchesQ && matchesSet;
    });

    const start = (pageNum - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    const cards = paged.map((c: any) => ({
      id: c.id ?? c.localId ?? String(Math.random()),
      name: c.name ?? '',
      number: c.localId ?? '',
      rarity: c.rarity ?? '',
      type: Array.isArray(c.types) ? c.types[0] ?? '' : '',
      color: Array.isArray(c.types) ? c.types : [],
      power: c.hp ?? null,
      cost: null,
      image_url: c.image
        ? `${c.image}/high.webp`
        : `https://placehold.co/200x280/111118/666?text=${encodeURIComponent(c.name ?? 'OP')}`,
      set_id: c.set?.id ?? '',
      set_name: c.set?.name ?? '',
      price_eur: null,
    }));

    return res.status(200).json({ cards, total: filtered.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: String(err?.message ?? err) });
  }
}