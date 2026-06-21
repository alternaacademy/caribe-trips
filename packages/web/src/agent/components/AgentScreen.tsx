import type { ReactNode } from 'react';
import styles from './AgentScreen.module.css';

/** A backoffice screen: sticky topbar (title + result-count meta + optional
 *  action) over content. */
export function AgentScreen({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.topbarRight}>
          {meta != null && <span className={styles.meta}>{meta}</span>}
          {action}
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </>
  );
}
