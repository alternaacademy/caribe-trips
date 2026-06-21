/** Mobile-shell detection. True inside the Tauri Android build; in a normal
 *  browser it can be forced for development/testing via `?mobile=1` (sticky) or
 *  `VITE_MOBILE=1` at build time. `?mobile=0` clears the override. */

const FORCE_KEY = 'caribe.forceMobileShell';

// One-time URL → localStorage sync at module load (no side effects in render).
if (typeof window !== 'undefined') {
  const flag = new URLSearchParams(window.location.search).get('mobile');
  if (flag === '1') localStorage.setItem(FORCE_KEY, '1');
  else if (flag === '0') localStorage.removeItem(FORCE_KEY);
}

/** True when running inside a Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** True when the native mobile shell (tab bar, reset, etc.) should render. */
export function isMobileShell(): boolean {
  if (isTauri()) return true;
  if (import.meta.env.VITE_MOBILE === '1') return true;
  return typeof localStorage !== 'undefined' && localStorage.getItem(FORCE_KEY) === '1';
}
