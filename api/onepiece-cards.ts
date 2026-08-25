// api/onepiece-cards.ts
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;

  try {
    const params = new URLSearchParams();
    if (q) params.set('keyWord', q as string);
    if (set) params.set('series', set as string);
    params.set('pageNo', page as string);
    params.set('pageSize', '20');

    const r = await fetch(
      `https://en.onepiece-cardgame.com/api/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://en.onepiece-cardgame.com/',
          'User-Agent': 'Mozilla/5.0',
        }
      }
    );

    if (!r.ok) return res.status(200).json({ cards: [], total: 0 });
    const data = await r.json();

    const cards = (data.result ?? data.list ?? []).map((c: any) => ({
      id: c.id ?? c.number,
      name: c.name ?? c.cardName ?? '',
      number: c.number ?? c.cardNo ?? '',
      rarity: c.rarity ?? '',
      type: c.type ?? '',
      color: c.color ? [c.color] : [],
      power: c.power ?? null,
      cost: c.cost ?? null,
      image_url: c.imgUrl ?? `https://en.onepiece-cardgame.com/images/cardlist/card/${c.number}.png`,
      set_id: set || '',
      set_name: c.series ?? '',
      price_eur: null,
    }));

    return res.status(200).json({ cards, total: data.total ?? cards.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: err.message });
  }
}