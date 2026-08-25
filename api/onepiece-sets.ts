// api/onepiece-sets.ts
const SETS = [
  { id: 'OP01', name: 'Romance Dawn', releaseDate: '2022-12-02', total: 121 },
  { id: 'OP02', name: 'Paramount War', releaseDate: '2023-03-10', total: 121 },
  { id: 'OP03', name: 'Pillars of Strength', releaseDate: '2023-06-30', total: 121 },
  { id: 'OP04', name: 'Kingdoms of Intrigue', releaseDate: '2023-09-22', total: 121 },
  { id: 'OP05', name: 'Awakening of the New Era', releaseDate: '2023-12-08', total: 121 },
  { id: 'OP06', name: 'Wings of the Captain', releaseDate: '2024-03-08', total: 121 },
  { id: 'OP07', name: '500 Years in the Future', releaseDate: '2024-06-28', total: 121 },
  { id: 'OP08', name: 'Two Legends', releaseDate: '2024-09-27', total: 121 },
  { id: 'OP09', name: 'The Four Emperors', releaseDate: '2024-12-27', total: 121 },
  { id: 'ST01', name: 'Starter Deck: Straw Hat Crew', releaseDate: '2022-12-02', total: 17 },
  { id: 'ST02', name: 'Starter Deck: Worst Generation', releaseDate: '2022-12-02', total: 17 },
  { id: 'ST03', name: 'Starter Deck: The Seven Warlords', releaseDate: '2022-12-02', total: 17 },
  { id: 'ST04', name: 'Starter Deck: Animal Kingdom Pirates', releaseDate: '2022-12-02', total: 17 },
  { id: 'ST05', name: 'Starter Deck: Film Edition', releaseDate: '2023-03-10', total: 17 },
  { id: 'ST06', name: 'Starter Deck: Absolute Justice', releaseDate: '2023-06-30', total: 17 },
  { id: 'ST07', name: 'Starter Deck: Big Mom Pirates', releaseDate: '2023-09-22', total: 17 },
  { id: 'ST08', name: 'Starter Deck: Monkey D. Luffy', releaseDate: '2023-12-08', total: 17 },
  { id: 'ST09', name: 'Starter Deck: Yamato', releaseDate: '2023-12-08', total: 17 },
  { id: 'ST10', name: 'Starter Deck: UTA', releaseDate: '2024-03-08', total: 17 },
  { id: 'EB01', name: 'Extra Booster: Memorial Collection', releaseDate: '2023-09-22', total: 50 },
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({ sets: SETS });
}