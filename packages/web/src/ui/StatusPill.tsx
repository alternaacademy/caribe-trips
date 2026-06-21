import type { BookingStatus } from '@/api/types';
import styles from './StatusPill.module.css';

/** Booking status pill: `Pendiente` amber, `Confirmada` green. */
export function StatusPill({ status }: { status: BookingStatus }) {
  const tone = status === 'Confirmada' ? styles.confirmed : styles.pending;
  return <span className={`${styles.pill} ${tone}`}>{status}</span>;
}
