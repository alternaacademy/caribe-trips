import type { NavigateFunction } from 'react-router-dom';
import { isTauri } from './platform';

/** Wire the Android hardware/gesture back button to the router.
 *
 *  Behavior: on a deep screen, back pops the history; at a root tab, back goes
 *  to Inicio; at Inicio, a double-back within 2s exits the app (with a toast).
 *
 *  Tauri 2 routes the Android back button through the webview's history by
 *  default, so browser history already gives correct stack popping. This adds
 *  the double-back-to-exit affordance via Tauri's close-request event. The
 *  listener only attaches inside Tauri; on the web it is a no-op. Device-only
 *  behavior (exit) cannot be exercised in a browser. */
export function installAndroidBack(
  navigate: NavigateFunction,
  onExitHint: () => void,
  isAtRoot: () => boolean,
): () => void {
  if (!isTauri()) return () => {};

  let lastBack = 0;
  let unlisten: (() => void) | undefined;

  import('@tauri-apps/api/window')
    .then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      unlisten = await win.onCloseRequested((event) => {
        if (!isAtRoot()) {
          event.preventDefault();
          navigate(-1);
          return;
        }
        const now = Date.now();
        if (now - lastBack < 2000) return; // allow the close to proceed → exit
        lastBack = now;
        event.preventDefault();
        onExitHint();
      });
    })
    .catch(() => {
      /* Tauri API unavailable — leave default back behavior. */
    });

  return () => unlisten?.();
}
