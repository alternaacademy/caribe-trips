import styles from './Chip.module.css';

/** Destination filter chip with on/off state (`aria-pressed`). */
export function Chip({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.on}` : styles.chip}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
