import type { Tcg } from '@/types';

/**
 * Recognition provider — the abstraction over any card-recognition backend.
 *
 * Future AI providers (a CollectIQ edge function, a third-party vision API,
 * an on-device model) each implement this interface. The scanner service
 * depends on the interface, not a concrete provider, so swapping providers is
 * a one-line wiring change in the composition root.
 *
 * Not implemented yet — this file defines the contract only.
 */

/** A single candidate card match returned by a recognition provider. */
export interface RecognitionCandidate {
  cardId: string;
  tcg: Tcg;
  /** Confidence in [0,1]. */
  confidence: number;
  /** Display name, if the provider can resolve it. */
  name?: string;
  /** Set/expansion code, if known. */
  setCode?: string;
}

/** Structured result of a recognition request. */
export interface RecognitionResult {
  candidates: RecognitionCandidate[];
  /** Provider-specific debug/trace info — never shown to the user. */
  meta?: Record<string, unknown>;
}

/** Input to a recognition request. */
export interface RecognitionInput {
  /** Image bytes as a data URL or base64 string. */
  image: string;
  /** Which TCG to bias recognition toward. */
  tcg?: Tcg;
}

/**
 * Every recognition provider implements this. Register implementations in the
 * scanner service's composition root; the rest of the app never imports a
 * concrete provider directly.
 */
export interface RecognitionProvider {
  readonly id: string;
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}
