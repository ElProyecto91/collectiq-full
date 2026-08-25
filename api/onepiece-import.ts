// @ts-nocheck
declare const process: { env: Record<string, string> };
// api/onepiece-cards.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SETS = [
  { id: 'OP01', name: 'Romance Dawn' },
  { id: 'OP02', name: 'Paramount War' },
  { id: 'OP03', name: 'Pillars of Strength' },
  { id: 'OP04', name: 'Kingdoms of Intrigue' },
  { id: 'OP05', name: 'Awakening of the New Era' },
  { id: 'OP06', name: 'Wings of the Captain' },
  { id: 'OP07', name: '500 Years in the Future' },
  { id: 'OP08', name: 'Two Legends' },
  { id: 'OP09', name: 'The Four Emperors' },
  { id: 'ST01', name: 'Starter Deck: Straw Hat Crew' },
  { id: 'ST02', name: 'Starter Deck: Worst Generation' },
  { id: 'ST03', name: 'Starter Deck: The Seven Warlords' },
  { id: 'ST04', name: 'Starter Deck: Animal Kingdom Pirates' },
  { id: 'ST05', name: 'Starter Deck: Film Edition' },
  { id: 'ST06', name: 'Starter Deck: Absolute Justice' },
  { id: 'ST07', name: 'Starter Deck: Big Mom Pirates' },
  { id: 'ST08', name: 'Starter Deck: Monkey D. Luffy' },
  { id: 'ST09', name: 'Starter Deck: Yamato' },
  { id: 'ST10', name: 'Starter Deck: UTA' },
];

async function fetchSetCards(setId: string, setName: string): Promise<any[]> {
  try {
    // Usar el repositorio público de datos de One Piece TCG en GitHub
    const url = `https://raw.githubusercontent.com/foxel94/OnePiece-TCG-Card-Database/main/cards/${setId}.json`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return (Array.isArray(data) ? data : []).map((c: any) => ({
      id: c.id ?? `${setId}-${c.number}`,
      name: c.name ?? '',
      number: c.number ?? '',
      rarity: c.rarity ?? '',
      type: c.type ?? '',
      color: Array.isArray(c.color) ? c.color : (c.color ? [c.color] : []),
      power: c.power ? parseInt(String(c.power).replace(/\D/g, '')) || null : null,
      cost: c.cost ? parseInt(String(c.cost)) || null : null,
      image_url: c.image_url ?? `https://en.onepiece-cardgame.com/images/cardlist/card/${c.number}.png`,
      set_id: setId,
      set_name: setName,
    }));
  } catch {
    return [];
  }
}

export default async function handler(req: any, res: any) {
  // Solo admin
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let totalImported = 0;
  const results: Record<string, number> = {};

  for (const set of SETS) {
    const cards = await fetchSetCards(set.id, set.name);
    if (cards.length === 0) {
      results[set.id] = 0;
      continue;
    }

    const { error } = await supabase
      .from('onepiece_cards')
      .upsert(cards, { onConflict: 'id' });

    if (!error) {
      results[set.id] = cards.length;
      totalImported += cards.length;
    } else {
      results[set.id] = -1;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return res.status(200).json({ ok: true, totalImported, results });
}