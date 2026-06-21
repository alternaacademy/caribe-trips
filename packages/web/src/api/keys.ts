import type { PackageListParams } from './packages';
import type { BookingStatus } from './types';

/** Centralized query keys so hooks and invalidations never drift. The leading
 *  segment (`'packages'`, `'bookings'`) is used for broad invalidation. */
export const queryKeys = {
  packages: (params: PackageListParams = {}) => ['packages', params] as const,
  package: (id: string) => ['package', id] as const,
  bookings: (status?: BookingStatus) => ['bookings', status ?? 'all'] as const,
  booking: (code: string) => ['booking', code] as const,
};
