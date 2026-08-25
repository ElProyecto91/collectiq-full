// api/onepiece-cards.ts
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const pageSize = 20;

  try {
    // TCGdex tiene One Piece TCG con API pública
    let url = `https://api.tcgdex.net/v2/en/cards?`;
    const filters: string[] = ['serie.name=One Piece'];
    if (q) filters.push(`name=${encodeURIComponent(q as string)}`);
    if (set) filters.push(`set.name=${encodeURIComponent(set as string)}`);
    url += filters.join('&');

    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!r.ok) throw new Error(`TCGdex error: ${r.status}`);
    const data = await r.json();

    const allCards = Array.isArray(data) ? data : [];
    const start = (pageNum - 1) * pageSize;
    const paged = allCards.slice(start, start + pageSize);

    const cards = paged.map((c: any) => ({
      id: c.id ?? c.localId ?? '',
      name: c.name ?? '',
      number: c.localId ?? '',
      rarity: c.rarity ?? '',
      type: c.types?.[0] ?? '',
      color: c.types ?? [],
      power: c.hp ?? null,
      cost: c.cost ?? null,
      image_url: c.image ? `${c.image}/high.webp` : `https://placehold.co/200x280/111118/666?text=OP`,
      set_id: c.set?.id ?? '',
      set_name: c.set?.name ?? '',
      price_eur: null,
    }));

    return res.status(200).json({ cards, total: allCards.length });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: err.message });
  }
}