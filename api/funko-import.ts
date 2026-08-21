export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_ID = 1299079722;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { adminId, offset = 0, limit = 500 } = await req.json();
    if (adminId !== ADMIN_ID) return new Response('Unauthorized', { status: 401 });

    // Descargar dataset público
    const dataRes = await fetch(
      'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json'
    );
    const allData = await dataRes.json();

    const batch = allData.slice(offset, offset + limit);

    const records = batch.map((item: any) => ({
      name: item.title ?? 'Unknown',
      franchise: item.series?.[0] ?? null,
      series: item.series?.join(', ') ?? null,
      image_url: item.image ?? null,
      type: 'pop',
    }));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/funko_items`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(records),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({
      ok: true,
      imported: records.length,
      total: allData.length,
      nextOffset: offset + limit,
      done: offset + limit >= allData.length,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
}