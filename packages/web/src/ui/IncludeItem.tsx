import type { ReactNode } from 'react';
import styles from './IncludeItem.module.css';
import { CheckIcon, MinusIcon } from './icons';

/** A "qué incluye" row: green check when included, muted dash when not. */
export function IncludeItem({ included, children }: { included: boolean; children: ReactNode }) {
  return (
    <li className={included ? styles.item : `${styles.item} ${styles.excluded}`}>
      <span className={styles.icon}>
        {included ? <CheckIcon size={16} /> : <MinusIcon size={16} />}
      </span>
      <span>{children}</span>
    </li>
  );
}
