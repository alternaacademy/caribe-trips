import type { Destination } from '@/api/types';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface Filters {
  destination?: Destination;
  q: string;
  setDestination: (destination?: Destination) => void;
  setQ: (q: string) => void;
  reset: () => void;
}

/** Home filter state mirrored into the URL query (`?destination=&q=`) so it is
 *  shareable and survives back/forward + reload. */
export function useFilters(): Filters {
  const [params, setParams] = useSearchParams();
  const destination = (params.get('destination') as Destination | null) ?? undefined;
  const q = params.get('q') ?? '';

  const setDestination = useCallback(
    (next?: Destination) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next) out.set('destination', next);
          else out.delete('destination');
          return out;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const setQ = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next) out.set('q', next);
          else out.delete('q');
          return out;
        },
        // Replace so debounced typing doesn't flood the history stack.
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => setParams({}, { replace: false }), [setParams]);

  return { destination, q, setDestination, setQ, reset };
}
