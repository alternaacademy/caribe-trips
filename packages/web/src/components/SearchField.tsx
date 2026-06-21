import { SearchIcon, XIcon } from '@/ui/icons';
import styles from './SearchField.module.css';

/** Always-visible search pill. The app-bar icon focuses `#search-input`. */
export function SearchField({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.search}>
      <div className={value ? `${styles.box} ${styles.hasValue}` : styles.box}>
        <span className={styles.icon}>
          <SearchIcon size={18} />
        </span>
        <input
          id="search-input"
          className={styles.input}
          type="search"
          placeholder="¿A dónde quieres ir?"
          aria-label="Buscar paquetes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className={styles.clear}
            onClick={onClear}
            aria-label="Limpiar búsqueda"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
