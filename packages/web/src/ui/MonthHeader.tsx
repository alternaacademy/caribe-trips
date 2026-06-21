import styles from './MonthHeader.module.css';

/** Sticky month divider for the chronological departures list. */
export function MonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className={styles.head}>
      <h2 className={styles.name}>{label}</h2>
      <span className={styles.count}>
        {count} {count === 1 ? 'salida' : 'salidas'}
      </span>
    </div>
  );
}
