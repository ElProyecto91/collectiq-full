export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  
  // eBay envía un GET con challenge_code para verificar el endpoint
  const challengeCode = url.searchParams.get('challenge_code');
  
  if (challengeCode) {
    const verificationToken = 'collectiq_ebay_deletion_secret_2026_abc123';
    const endpoint = 'https://collectiq-full.vercel.app/api/ebay-deletion';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(challengeCode + verificationToken + endpoint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return new Response(JSON.stringify({ challengeResponse }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST — notificación de borrado de cuenta
  return new Response('OK', { status: 200 });
}