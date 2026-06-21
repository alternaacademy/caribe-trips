import { Button } from './Button';
import { Price } from './Price';
import styles from './StickyCta.module.css';

/** Bottom action bar: price on the left, primary CTA on the right.
 *  Safe-area aware (sits above the device home indicator). */
export function StickyCta({
  amount,
  from = false,
  actionLabel,
  onAction,
  loading = false,
  disabled = false,
  caption,
}: {
  amount: number;
  from?: boolean;
  actionLabel: string;
  onAction?: () => void;
  loading?: boolean;
  disabled?: boolean;
  caption?: string;
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.priceCol}>
        {caption && <span className={styles.caption}>{caption}</span>}
        <Price amount={amount} from={from} />
      </div>
      <Button variant="primary" onClick={onAction} loading={loading} disabled={disabled}>
        {actionLabel}
      </Button>
    </div>
  );
}
