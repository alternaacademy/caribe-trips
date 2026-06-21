import type { ReactNode } from 'react';
import styles from './Counter.module.css';

export function Counters({ children }: { children: ReactNode }) {
  return <div className={styles.counters}>{children}</div>;
}

/** A labeled metric with a colored dot. */
export function Counter({
  tone,
  label,
  value,
}: {
  tone: 'pending' | 'ok' | 'month';
  label: string;
  value: number;
}) {
  return (
    <div className={styles.counter}>
      <span className={`${styles.dot} ${styles[tone]}`} />
      <span className={styles.label}>{label}</span>
      <span className={styles.num}>{value}</span>
    </div>
  );
}
