import styles from './Toggle.module.css';

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? `${styles.toggle} ${styles.on}` : styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
