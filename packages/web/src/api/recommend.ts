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
  model: string;
  elapsedMs: number;
}

export function recommend(intent: string): Promise<Recommendation> {
  return request<Recommendation>('POST', '/recommend', { intent });
}
