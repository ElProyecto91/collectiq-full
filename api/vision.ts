export const config = { runtime: 'nodejs' };

export default async function handler(req: any, res: any): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY ?? 'NOT_FOUND';
  const allKeys = Object.keys(process.env).filter(k => !k.includes('npm') && !k.includes('PATH'));
  
  res.json({ 
    apiKey: apiKey.slice(0, 10) + '...', 
    found: apiKey !== 'NOT_FOUND',
    envKeys: allKeys 
  });
}