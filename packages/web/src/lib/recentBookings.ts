/** Device-local record of bookings made on this device. The booking flow
 *  records an entry on success; the Android "Mis reservas" screen (Task 25)
 *  lists them and fetches each status fresh by code. localStorage is the store
 *  (the Tauri store is preferred on device — see notes/MOBILE.md). */

const KEY = 'caribe.recentBookings';

export interface RememberedBooking {
  code: string;
  packageTitle: string;
  departureDate: string;
  savedAt: string;
}

export function rememberBooking(entry: Omit<RememberedBooking, 'savedAt'>): void {
  try {
    const list = listRememberedBookings().filter((b) => b.code !== entry.code);
    list.unshift({ ...entry, savedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode / SSR) — non-fatal.
  }
}

export function listRememberedBookings(): RememberedBooking[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((b): b is RememberedBooking => typeof b?.code === 'string')
      : [];
  } catch {
    return [];
  }
}

export function forgetBooking(code: string): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(listRememberedBookings().filter((b) => b.code !== code)),
    );
  } catch {
    // ignore
  }
}
