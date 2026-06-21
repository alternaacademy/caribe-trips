import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './MobileChrome.module.css';
import { installAndroidBack } from './back';
import './webview-reset.css';

/** Non-visual mobile-shell wiring: adds the WebView-reset `mobile-shell` class
 *  to <html>, hooks the Android back button to the router, and shows the
 *  double-back-to-exit hint. The exit affordance is device-only (Tauri). */
export function MobileBack() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [exitHint, setExitHint] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('mobile-shell');
    return () => document.documentElement.classList.remove('mobile-shell');
  }, []);

  useEffect(
    () =>
      installAndroidBack(
        navigate,
        () => {
          setExitHint(true);
          setTimeout(() => setExitHint(false), 2000);
        },
        () => pathname === '/',
      ),
    [navigate, pathname],
  );

  if (!exitHint) return null;
  return (
    <output className={styles.exitToast} aria-live="polite">
      Pulsa atrás de nuevo para salir
    </output>
  );
}
