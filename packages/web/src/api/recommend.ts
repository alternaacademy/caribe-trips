import { request } from './client';
import type { Package } from './types';

/** A grounded concierge answer: one hero package plus two smaller alternatives.
 *  Every package here came back from the API re-hydrated from the database —
 *  the model only chose, it never authored these prices or dates. */
export interface Recommendation {
  package: Package;
  headline: string;
  why: string;
  considerations: string;
  alsoConsider: Package[];
  /** False when nothing in the catalog genuinely answers the request — the
   *  package is then the closest option, not a match. */
  fits: boolean;
  /** The model's own confidence; below `LOW_CONFIDENCE` the UI softens its framing. */
  confidence: number;
  model: string;
  elapsedMs: number;
}

export const LOW_CONFIDENCE = 0.6;

export function recommend(intent: string, signal?: AbortSignal): Promise<Recommendation> {
  return request<Recommendation>('POST', '/recommend', { intent }, signal);
}
