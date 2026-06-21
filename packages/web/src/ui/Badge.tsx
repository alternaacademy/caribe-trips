import styles from './Badge.module.css';
import { StarIcon } from './icons';

/** "Destacado" badge (coral, star). Absolutely positioned over card media. */
export function Badge({ label = 'Destacado' }: { label?: string }) {
  return (
    <span className={styles.badge}>
      <StarIcon size={14} />
      {label}
    </span>
  );
}
