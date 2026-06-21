import styles from './Price.module.css';
import { formatRD } from './format';

/** Serif price. With `from`, renders the "desde" eyebrow above the amount. */
export function Price({ amount, from = false }: { amount: number; from?: boolean }) {
  return (
    <span className={styles.price}>
      {from && <small>desde</small>}
      <b>{formatRD(amount)}</b>
    </span>
  );
}
