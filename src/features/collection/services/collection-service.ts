import { collectionRepository } from './collection-repository';
import { ApiError } from '@/utils/error';
import type { CatalogCard } from '@/features/catalog/types/catalog';
import type {
  UserCard,
  UserCardInput,
  UserCardUpdate,
  CollectionQuery,
  CollectionStats,
  CardSnapshot,
  Condition,
  Language,
  Finish,
  AcquisitionMethod,
} from '../types/collection';

/**
 * CollectionService — business-logic layer for the collection feature.
 *
 * Sits between the hooks (React Query) and the repository (data access).
 * Knows how to build a `CardSnapshot` from a `CatalogCard`, validate inputs,
 * and translate domain intents into repository calls. Future TCG providers
 * (Scanner integration, One Piece) would get their own snapshot builder here.
 */
class CollectionService {
  /** Build a card snapshot from a catalog card for storage. */
  buildSnapshot(card: CatalogCard): CardSnapshot {
    return {
      name: card.name,
      setName: card.set.name,
      setCode: card.set.id,
      rarity: card.rarity,
      imageUrl: card.images.small ?? card.images.large,
      supertype: card.supertype,
      subtypes: card.subtypes,
      number: card.number,
    };
  }

  async list(query: CollectionQuery): Promise<UserCard[]> {
    return collectionRepository.list(query);
  }

  async findByCardId(telegramUserId: number, cardId: string): Promise<UserCard | null> {
    return collectionRepository.findByCardId(telegramUserId, cardId);
  }

  async create(input: UserCardInput): Promise<UserCard> {
    if (input.quantity !== undefined && input.quantity < 1) {
      throw new ApiError('Quantity must be at least 1', { code: 'COLLECTION_INVALID_QTY' });
    }
    return collectionRepository.create(input);
  }

  async update(id: string, update: UserCardUpdate): Promise<UserCard> {
    if (update.quantity !== undefined && update.quantity < 1) {
      throw new ApiError('Quantity must be at least 1', { code: 'COLLECTION_INVALID_QTY' });
    }
    return collectionRepository.update(id, update);
  }

  async remove(id: string): Promise<void> {
    return collectionRepository.remove(id);
  }

  async stats(telegramUserId: number): Promise<CollectionStats> {
    return collectionRepository.stats(telegramUserId);
  }

  /** Convenience: build a full input from a catalog card + form values. */
  buildInput(
    telegramUserId: number,
    card: CatalogCard,
    form: CollectionFormValues
  ): UserCardInput {
    return {
      telegramUserId,
      pokemonCardId: card.id,
      quantity: form.quantity,
      condition: form.condition as Condition | null,
      language: form.language as Language | null,
      edition: form.edition || null,
      finish: form.finish as Finish | null,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      acquisitionMethod: form.acquisitionMethod as AcquisitionMethod | null,
      acquisitionDate: form.acquisitionDate || null,
      notes: form.notes || null,
      favorite: form.favorite,
      showcase: form.showcase,
      snapshot: this.buildSnapshot(card),
    };
  }
}

export const collectionService = new CollectionService();

/**
 * Form values shape for the Add/Edit modal. All fields are string | number |
 * boolean | null for form input ergonomics; the service converts them to
 * the correct types on save.
 */
export interface CollectionFormValues {
  quantity: number;
  condition: string | null;
  language: string | null;
  edition: string;
  finish: string | null;
  purchasePrice: string;
  acquisitionMethod: string | null;
  acquisitionDate: string;
  notes: string;
  favorite: boolean;
  showcase: boolean;
}

/** Default empty form for adding a new card. */
export const DEFAULT_FORM_VALUES: CollectionFormValues = {
  quantity: 1,
  condition: 'Near Mint',
  language: 'English',
  edition: '',
  finish: 'Normal',
  purchasePrice: '',
  acquisitionMethod: 'Bought',
  acquisitionDate: '',
  notes: '',
  favorite: false,
  showcase: false,
};
