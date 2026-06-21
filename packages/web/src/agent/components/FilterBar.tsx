import { SearchIcon } from '@/ui/icons';
import type { ReactNode } from 'react';
import styles from './FilterBar.module.css';

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.bar}>{children}</div>;
}

/** Pill segmented control (single-select). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a segmented toggle group is not a form fieldset.
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Styled native select with a chevron. */
export function AgentSelect({
  value,
  onChange,
  label,
  active = false,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={active ? `${styles.select} ${styles.selectActive}` : styles.select}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <span className={styles.chev} aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

/** Inline search input. */
export function AgentSearch({
  value,
  onChange,
  placeholder = 'Buscar',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className={styles.search}>
      <SearchIcon size={16} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function FilterClear({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.clear} onClick={onClick}>
      Limpiar
    </button>
  );
}
