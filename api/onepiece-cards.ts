export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const offset = (pageNum - 1) * 20;

  try {
    let url = `https://www.op-tcg.com/api/cards?limit=20&offset=${offset}`;
    if (q) url += `&name=${encodeURIComponent(q as string)}`;
    if (set) url += `&set=${encodeURIComponent(set as string)}`;

    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      }
    });

    if (!r.ok) return res.status(200).json({ cards: [], total: 0, error: `Status ${r.status}` });

    const text = await r.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch { return res.status(200).json({ cards: [], total: 0, error: 'Not JSON: ' + text.slice(0, 150) }); }

    const list = data.cards ?? data.results ?? data.data ?? data ?? [];
    const cards = (Array.isArray(list) ? list : []).map((c: any) => ({
      id: c.id ?? c.card_id ?? c.number ?? String(Math.random()),
      name: c.name ?? '',
      number: c.number ?? c.card_number ?? '',
      rarity: c.rarity ?? '',
      type: c.type ?? c.card_type ?? '',
      color: c.color ? (Array.isArray(c.color) ? c.color : [c.color]) : [],
      power: c.power ?? null,
      cost: c.cost ?? null,
      image_url: c.image ?? c.image_url ?? c.img_url ??
        `https://placehold.co/200x280/111118/666?text=${encodeURIComponent(c.name ?? 'OP')}`,
      set_id: c.set ?? set ?? '',
      set_name: c.set_name ?? c.series ?? '',
      price_eur: null,
    }));

    return res.status(200).json({ cards, total: data.total ?? data.count ?? cards.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: String(err?.message ?? err) });
  }
}