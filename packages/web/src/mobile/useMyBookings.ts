import {
  type RememberedBooking,
  forgetBooking,
  listRememberedBookings,
} from '@/lib/recentBookings';
import { useCallback, useState } from 'react';

/** Device-local bookings list with manual reload + remove. */
export function useMyBookings() {
  const [items, setItems] = useState<RememberedBooking[]>(() => listRememberedBookings());
  const reload = useCallback(() => setItems(listRememberedBookings()), []);
  const remove = useCallback((code: string) => {
    forgetBooking(code);
    setItems(listRememberedBookings());
  }, []);
  return { items, reload, remove };
}
