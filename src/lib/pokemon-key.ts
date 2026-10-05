/**
 * Pokémon TCG API key (optional: the API works without one, with lower rate limits). It ships in the browser
 * bundle by design, so it must be a rate-limit key only, never a secret. Two names were in use; both work.
 */
const env = import.meta.env;
export const POKEMON_API_KEY: string = (env.VITE_POKEMONTCG_API_KEY as string | undefined) ?? (env.VITE_POKEMON_TCG_API_KEY as string | undefined) ?? '';
