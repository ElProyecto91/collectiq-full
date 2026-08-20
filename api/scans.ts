export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function getOrCreateScanRecord(telegramUserId: number, today: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_scans?telegram_user_id=eq.${telegramUserId}&scan_date=eq.${today}&select=*`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const data = await res.json();
  if (data?.length > 0) return data[0];

  // Obtener acumulados del día anterior
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prevRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_scans?telegram_user_id=eq.${telegramUserId}&scan_date=eq.${yesterday}&select=scans_accumulated`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const prevData = await prevRes.json();
  const prevAccumulated = prevData?.[0]?.scans_accumulated ?? 0;

  // Crear registro de hoy
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/user_scans`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      scan_date: today,
      scans_used: 0,
      scans_accumulated: prevAccumulated,
    }),
  });
  const created = await createRes.json();
  return created?.[0] ?? { scans_used: 0, scans_accumulated: prevAccumulated };
}

export default async function handler(req: Request) {
  if (req.method === 'GET') {
    // Obtener estado de escaneos
    try {
      const url = new URL(req.url);
      const telegramUserId = parseInt(url.searchParams.get('userId') ?? '0');
      if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });

      const today = new Date().toISOString().split('T')[0];
      const record = await getOrCreateScanRecord(telegramUserId, today);

      return new Response(JSON.stringify({
        scansUsed: record.scans_used ?? 0,
        scansAccumulated: record.scans_accumulated ?? 0,
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const { telegramUserId, action, amount } = await req.json();
      if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), { status: 400 });

      const today = new Date().toISOString().split('T')[0];
      const record = await getOrCreateScanRecord(telegramUserId, today);

      let newScansUsed = record.scans_used ?? 0;
      let newAccumulated = record.scans_accumulated ?? 0;

      if (action === 'use') {
        // Usar un escaneo — primero de acumulados, luego de diarios
        if (newAccumulated > 0) {
          newAccumulated = Math.max(0, newAccumulated - 1);
        } else {
          newScansUsed = newScansUsed + 1;
        }
      } else if (action === 'add_accumulated') {
        // Añadir escaneos acumulados (por ver anuncio)
        newAccumulated = newAccumulated + (amount ?? 1);
      } else if (action === 'add_referral') {
        // Añadir escaneos por referido
        newAccumulated = newAccumulated + (amount ?? 10);
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/user_scans?telegram_user_id=eq.${telegramUserId}&scan_date=eq.${today}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scans_used: newScansUsed,
            scans_accumulated: newAccumulated,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return new Response(JSON.stringify({
        scansUsed: newScansUsed,
        scansAccumulated: newAccumulated,
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}