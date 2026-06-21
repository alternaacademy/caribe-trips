import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';
import { SearchIcon } from './icons';

/** Centered empty state with optional action. */
export function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>{icon ?? <SearchIcon size={28} />}</span>
      <h2 className={styles.title}>{title}</h2>
      {text && <p className={styles.text}>{text}</p>}
      {actionLabel && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
