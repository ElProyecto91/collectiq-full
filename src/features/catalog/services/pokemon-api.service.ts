import { ApiError } from '@/utils/error';

import { PokemonApiConfig } from './pokemon-api.config';
import type {
  PokemonTcgCard,
  PokemonTcgListResponse,
  PokemonTcgSingleResponse,
} from '../types/pokemon-tcg-api';

/**
 * PokemonApiService — thin HTTP client for api.pokemontcg.io (v2).
 *
 * Responsible only for transport: building URLs, attaching the optional API
 * key, executing `fetch`, and turning non-2xx responses into typed ApiErrors.
 * It knows nothing about domain types or caching — that's the repository's and
 * React Query's job. Keeping the transport layer isolated means the repository
 * can be tested against a stub client, and a future provider (One Piece, Magic)
 * gets the same thin-client treatment.
 */
class PokemonApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string = PokemonApiConfig.baseUrl, apiKey: string = PokemonApiConfig.apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers['X-Api-Key'] = this.apiKey;
    return headers;
  }

  private async request<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (searchParams) {
      searchParams.forEach((value, key) => url.searchParams.append(key, value));
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: this.headers(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ApiError('Could not reach the Pokémon TCG API. Check your connection.', {
        code: 'CATALOG_NETWORK',
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ApiError(
        response.status === 429
          ? 'The catalog is busy right now. Please try again shortly.'
          : 'The Pokémon TCG API returned an error.',
        {
          status: response.status,
          code: response.status === 429 ? 'CATALOG_RATE_LIMITED' : 'CATALOG_HTTP_ERROR',
        }
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ApiError('Could not parse the catalog response.', {
        code: 'CATALOG_PARSE',
        cause: error,
      });
    }
  }

  /** Search cards with a q= query string and pagination. */
  async searchCards(
    query: string,
    page: number,
    pageSize: number
  ): Promise<PokemonTcgListResponse<PokemonTcgCard>> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
      orderBy: 'set.releaseDate desc,number',
    });
    return this.request<PokemonTcgListResponse<PokemonTcgCard>>('/cards', params);
  }

  /** Fetch a single card by id. */
  async getCard(id: string): Promise<PokemonTcgSingleResponse<PokemonTcgCard>> {
    return this.request<PokemonTcgSingleResponse<PokemonTcgCard>>(`/cards/${encodeURIComponent(id)}`);
  }
}

export const pokemonApiService = new PokemonApiService();
export type { PokemonApiService };
