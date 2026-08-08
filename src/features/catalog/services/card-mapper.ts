import type {
  CatalogCard,
  CatalogCardPage,
  CatalogSet,
  CardImages,
  CardLegalities,
} from '../types/catalog';
import type {
  PokemonTcgCard,
  PokemonTcgImageUris,
  PokemonTcgLegalities,
  PokemonTcgListResponse,
  PokemonTcgSet,
} from '../types/pokemon-tcg-api';

/**
 * Mapper: raw Pokémon TCG API payloads → CollectIQ domain types.
 *
 * The single translation point between the external API format and the app's
 * canonical shapes. If the API changes a field name or casing, only this file
 * needs to change — every consuming component sees the stable domain type.
 */

function toInt(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function mapImages(images: PokemonTcgImageUris | undefined): CardImages {
  return {
    small: images?.small ?? null,
    large: images?.large ?? null,
  };
}

function mapLegalities(
  legalities: PokemonTcgLegalities | undefined
): CardLegalities | null {
  if (!legalities) return null;
  const result: CardLegalities = {};
  if (legalities.standard) result.standard = legalities.standard;
  if (legalities.expanded) result.expanded = legalities.expanded;
  if (legalities.unlimited) result.unlimited = legalities.unlimited;
  return Object.keys(result).length > 0 ? result : null;
}

function mapSet(set: PokemonTcgSet): CatalogSet {
  return {
    id: set.id,
    name: set.name,
    series: set.series ?? null,
    printedTotal: set.printedTotal ?? null,
    total: set.total ?? null,
    releaseDate: set.releaseDate ?? null,
    logoUrl: set.images?.logo ?? null,
    symbolUrl: set.images?.symbol ?? null,
  };
}

export function mapCard(raw: PokemonTcgCard): CatalogCard {
  return {
    id: raw.id,
    name: raw.name,
    supertype: raw.supertype ?? null,
    subtypes: raw.subtypes ?? [],
    hp: toInt(raw.hp),
    types: raw.types ?? [],
    set: mapSet(raw.set),
    number: raw.number,
    rarity: raw.rarity ?? null,
    regulationMark: raw.regulationMark ?? null,
    artist: raw.artist ?? null,
    images: mapImages(raw.images),
    legalities: mapLegalities(raw.legalities),
    flavorText: raw.flavorText ?? null,
    evolvesFrom: raw.evolvesFrom ?? null,
    retreatCost: raw.convertedRetreatCost ?? null,
    tcg: 'pokemon',
  };
}

export function mapCardPage(
  response: PokemonTcgListResponse<PokemonTcgCard>
): CatalogCardPage {
  return {
    cards: response.data.map(mapCard),
    page: response.page,
    pageSize: response.pageSize,
    totalCount: response.totalCount,
    hasMore: response.page * response.pageSize < response.totalCount,
  };
}
