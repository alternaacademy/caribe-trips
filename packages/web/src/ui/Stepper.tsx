import styles from './Stepper.module.css';
import { MinusIcon, PlusIcon } from './icons';

/** Numeric stepper (− n +), clamped to [min, max]. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  label = 'Cantidad',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would impose unwanted form semantics here.
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label="Restar"
      >
        <MinusIcon size={18} />
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="Sumar"
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
