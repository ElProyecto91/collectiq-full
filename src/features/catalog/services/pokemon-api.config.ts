/**
 * Pokémon TCG API configuration.
 *
 * The API base URL and optional API key live here so no endpoint strings are
 * hardcoded in services. The public API key is read from the environment if
 * provided (rate limits are higher with a key); the API works without one.
 */
const env = import.meta.env;

export const PokemonApiConfig = {
  baseUrl: 'https://api.pokemontcg.io/v2',
  /** Optional API key for higher rate limits (see https://pokemontcg.io/). */
  apiKey: (env.VITE_POKEMON_TCG_API_KEY as string | undefined) ?? '',
  /** Default page size for list/search endpoints. */
  defaultPageSize: 24,
  /** Max requests per minute the client will self-enforce (safety throttle). */
  maxPerPage: 250,
} as const;
