async function searchCards(query: string, page: number): Promise<{ cards: PokemonCard[]; total: number }> {
  const q = query.trim()
    ? `name:"*${query.trim()}*"`
    : 'name:Charizard OR name:Pikachu OR name:Mewtwo';

  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=20&orderBy=-set.releaseDate`;

  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_POKEMONTCG_API_KEY ?? '',
        },
      });
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      return { cards: json.data ?? [], total: json.totalCount ?? 0 };
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { cards: [], total: 0 };
}