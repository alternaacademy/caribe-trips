import styles from './MobileChrome.module.css';
import { useOnline } from './useOnline';

/** Slim "Sin conexión" bar shown at the top of the shell while offline,
 *  auto-hiding on reconnect (Task 24). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <output className={styles.banner} aria-live="polite">
      Sin conexión
    </output>
  );
}
