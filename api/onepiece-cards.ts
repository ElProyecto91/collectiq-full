export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);

  try {
    const body = {
      search: {
        momPrice: '', rangeMin: '', rangeMax: '',
        keyword: q || '',
        type: '',
        color: '',
        series: set || '',
        rarity: '',
        illustrator: '',
        power: '',
        cost: '',
        life: '',
        attribute: '',
        trigger: '',
        cardId: '',
      },
      language: 'en',
      pageNum,
      pageSize: 20,
    };

    const r = await fetch('https://en.onepiece-cardgame.com/cardlist/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://en.onepiece-cardgame.com/cardlist/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      return res.status(200).json({ cards: [], total: 0, error: `Status ${r.status}` });
    }

    const text = await r.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ cards: [], total: 0, error: 'Not JSON: ' + text.slice(0, 100) });
    }

    const list = data.result ?? data.list ?? data.cards ?? data.data ?? [];
    const cards = (Array.isArray(list) ? list : []).map((c: any) => ({
      id: c.cardId ?? c.id ?? c.number ?? String(Math.random()),
      name: c.name ?? c.cardName ?? '',
      number: c.cardId ?? c.number ?? '',
      rarity: c.rarity ?? '',
      type: c.type ?? '',
      color: c.color ? (Array.isArray(c.color) ? c.color : [c.color]) : [],
      power: c.power ?? null,
      cost: c.cost ?? null,
      image_url: c.imgUrl ?? c.image_url ?? c.image ??
        `https://en.onepiece-cardgame.com/images/cardlist/card/${c.cardId ?? c.number}.png`,
      set_id: set || '',
      set_name: c.series ?? '',
      price_eur: null,
    }));

    return res.status(200).json({ cards, total: data.total ?? cards.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: String(err?.message ?? err) });
  }
}