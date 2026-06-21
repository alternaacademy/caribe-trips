import styles from './Spinner.module.css';

/** Indeterminate loading spinner (inherits `currentColor`). */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  );
}
