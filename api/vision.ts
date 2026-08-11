export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const apiKey = (globalThis as any).process?.env?.GOOGLE_VISION_API_KEY ?? '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GOOGLE_VISION_API_KEY' }), { status: 500, headers });
    }

    const body = await req.json();
    const image = body?.image;

    if (!image) {
      return new Response(JSON.stringify({ error: 'Missing image field' }), { status: 400, headers });
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    );

    const visionData = await visionRes.json();

    if (!visionRes.ok) {
      const msg = visionData?.error?.message ?? `Vision API error ${visionRes.status}`;
      return new Response(JSON.stringify({ error: msg }), { status: visionRes.status, headers });
    }

    const text: string = visionData?.responses?.[0]?.fullTextAnnotation?.text ?? '';
    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500, headers });
  }
}