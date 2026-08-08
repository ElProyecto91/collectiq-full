import { pokemonApiService } from './pokemon-api.service';
import { PokemonApiConfig } from './pokemon-api.config';
import { mapCard, mapCardPage } from './card-mapper';
import type { CatalogCard, CatalogCardPage } from '../types/catalog';
import type { PokemonTcgCard } from '../types/pokemon-tcg-api';

/**
 * CardRepository — the catalog business-logic layer.
 *
 * Sits between the raw API client (transport) and the React Query hooks
 * (caching/UI). Its job is to turn a user-facing search intent ("find cards
 * named Pikachu") into a Pokémon TCG API `q=` query, fetch the results via the
 * API service, and map them into CollectIQ domain types. The repository is the
 * only place that knows the API's query syntax — hooks and pages never build
 * `q=` strings themselves.
 */

/**
 * Build a Pokémon TCG API query string from a free-text search.
 *
 * The API supports field-specific predicates (name:, number:, set.name:).
 * To match by card name, card number, OR set name from a single input box, we
 * OR the three predicates together. Individual terms are trimmed and quoted to
 * handle spaces; empty input falls back to a permissive query that returns the
 * newest cards so the Explorer is never blank on first load.
 */
function buildSearchQuery(input: string): string {
  const term = input.trim();
  if (!term) return 'set.id:*'; // broadest possible — returns newest cards

  // Escape double quotes inside the term for the API's quoted-string syntax.
  const safe = term.replace(/"/g, '\\"');

  // API q= syntax: OR-join the three searchable fields. The asterisk wildcards
  // make partial matches work (e.g. "pika" matches "Pikachu").
  return [
    `name:"*${safe}*"`,
    `number:"*${safe}*"`,
    `set.name:"*${safe}*"`,
  ].join(' OR ');
}

class CardRepository {
  private readonly api = pokemonApiService;
  private readonly pageSize: number;

  constructor(pageSize: number = PokemonApiConfig.defaultPageSize) {
    this.pageSize = pageSize;
  }

  /**
   * Search the catalog. Returns one page of domain-typed results plus
   * pagination metadata for infinite scrolling.
   */
  async search(query: string, page: number): Promise<CatalogCardPage> {
    const raw = await this.api.searchCards(buildSearchQuery(query), page, this.pageSize);
    return mapCardPage(raw);
  }

  /** Fetch a single card by id, mapped to the domain type. */
  async getById(id: string): Promise<CatalogCard> {
    const raw = await this.api.getCard(id);
    return mapCard(raw.data as PokemonTcgCard);
  }
}

export const cardRepository = new CardRepository();
export type { CardRepository };
