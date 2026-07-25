import type { Destination } from '@/api/types';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface Filters {
  destination?: Destination;
  setDestination: (destination?: Destination) => void;
  reset: () => void;
}

/** Home filter state mirrored into the URL query (`?destination=`) so it is
 *  shareable and survives back/forward + reload. */
export function useFilters(): Filters {
  const [params, setParams] = useSearchParams();
  const destination = (params.get('destination') as Destination | null) ?? undefined;

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

  const reset = useCallback(() => setParams({}, { replace: false }), [setParams]);

  return { destination, setDestination, reset };
}
