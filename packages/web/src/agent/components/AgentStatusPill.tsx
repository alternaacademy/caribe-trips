import type { BookingStatus } from '@/api/types';
import styles from './AgentStatusPill.module.css';

/** Backoffice status pill with a leading dot. Pending reads "Pago pendiente". */
export function AgentStatusPill({ status }: { status: BookingStatus }) {
  const pending = status === 'Pendiente';
  return (
    <span
      className={
        pending ? `${styles.pill} ${styles.pending}` : `${styles.pill} ${styles.confirmed}`
      }
    >
      {pending ? 'Pago pendiente' : 'Confirmada'}
    </span>
  );
}
