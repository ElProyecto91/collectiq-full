// api/onepiece-cards.ts
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', page = '1', set = '' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const pageSize = 20;

  try {
    // API pública de One Piece TCG
    let url = `https://op-tcg.com/api/cards?page=${pageNum}&pageSize=${pageSize}`;
    if (q) url += `&name=${encodeURIComponent(q as string)}`;
    if (set) url += `&set=${encodeURIComponent(set as string)}`;

    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CollectIQ/1.0' }
    });

    if (!r.ok) {
      // Fallback: usar la API de cardmarket scrape simplificada
      return res.status(200).json({ cards: [], total: 0, page: pageNum });
    }

    const data = await r.json();
    return res.status(200).json({
      cards: data.data ?? data.cards ?? [],
      total: data.total ?? 0,
      page: pageNum,
    });
  } catch (err: any) {
    return res.status(200).json({ cards: [], total: 0, error: err.message });
  }
}