export const config = { runtime: 'nodejs' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_ID = 1299079722;

// Fuentes públicas de datos Funko
const FUNKO_SOURCES = [
  {
    key: 'kennymkchan',
    url: 'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json',
    map: (item: any) => ({
      tcg: 'funko',
      external_id: `kennymkchan_${item.title?.replace(/\s+/g, '_').toLowerCase()}`,
      name: item.title ?? 'Unknown',
      franchise: item.series?.[0] ?? null,
      series: item.series?.join(', ') ?? null,
      image_url: item.imageName ?? null,
      line: 'Pop! Vinyl',
    }),
  },
  {
    key: 'funkopop_list',
    url: 'https://raw.githubusercontent.com/Bost/funkopop/master/funkopop.json',
    map: (item: any) => ({
      tcg: 'funko',
      external_id: `funkopop_${item.number ?? item.name?.replace(/\s+/g, '_').toLowerCase()}`,
      name: item.name ?? 'Unknown',
      franchise: item.category ?? null,
      number: item.number ? String(item.number) : null,
      line: 'Pop! Vinyl',
      is_chase: item.chase ?? false,
      is_flocked: item.flocked ?? false,
      is_glow: item.glow ?? false,
      exclusivity: item.exclusive ?? null,
    }),
  },
];

async function sb(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { adminId, source = 'all', offset = 0, batchSize = 500 } = req.body;
    if (adminId !== ADMIN_ID) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const results: Record<string, any> = {};

    for (const src of FUNKO_SOURCES) {
      if (source !== 'all' && source !== src.key) continue;

      try {
        const dataRes = await fetch(src.url);
        if (!dataRes.ok) { results[src.key] = { error: `HTTP ${dataRes.status}` }; continue; }

        const allData = await dataRes.json();
        const items = Array.isArray(allData) ? allData : Object.values(allData);
        const batch = items.slice(offset, offset + batchSize);
        const records = batch.map(src.map).filter((r: any) => r.name && r.name !== 'Unknown');

        await sb('/catalog_items', {
          method: 'POST',
          body: JSON.stringify(records),
        });

        results[src.key] = {
          imported: records.length,
          total: items.length,
          nextOffset: offset + batchSize,
          done: offset + batchSize >= items.length,
        };
      } catch (err: any) {
        results[src.key] = { error: err?.message };
      }
    }

    res.status(200).json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
}