import type { ReactNode } from 'react';
import styles from './Alert.module.css';
import { AlertIcon, CheckIcon } from './icons';

type Tone = 'success' | 'pending' | 'error';

/** Inline message banner. */
export function Alert({
  tone = 'pending',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  const toneClass = { success: styles.success, pending: styles.pending, error: styles.error }[tone];
  return (
    <div className={`${styles.alert} ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon}>
        {tone === 'success' ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
      </span>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
    </div>
  );
}
