import { ApiError } from '@/api/client';
import { useBookingByCode } from '@/api/hooks';
import type { RememberedBooking } from '@/lib/recentBookings';
import { PullToRefresh } from '@/mobile/PullToRefresh';
import { useMyBookings } from '@/mobile/useMyBookings';
import { EmptyState, Skeleton, StatusPill, formatDateShort } from '@/ui';
import { TicketIcon } from '@/ui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import styles from './MisReservas.module.css';

export function MisReservasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, remove } = useMyBookings();

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Mis reservas</h1>
        <EmptyState
          title="Aún no tienes reservas."
          text="Tus reservas hechas en este dispositivo aparecerán aquí."
          actionLabel="Explorar paquetes"
          onAction={() => navigate('/')}
          icon={<TicketIcon size={28} />}
        />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: ['booking'] })}>
      <div className={styles.page}>
        <h1 className={styles.title}>Mis reservas</h1>
        <ul className={styles.list}>
          {items.map((entry) => (
            <BookingRow
              key={entry.code}
              entry={entry}
              onOpen={() => navigate(`/booking/${entry.code}`)}
              onRemove={() => remove(entry.code)}
            />
          ))}
        </ul>
      </div>
    </PullToRefresh>
  );
}

/** A row that fetches the live status by code so a since-confirmed booking
 *  reflects "Confirmada". A deleted/unknown code degrades to "No disponible". */
function BookingRow({
  entry,
  onOpen,
  onRemove,
}: {
  entry: RememberedBooking;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { data: booking, isLoading, error } = useBookingByCode(entry.code);
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={onOpen}>
        <div className={styles.info}>
          <span className={styles.code}>{entry.code}</span>
          <span className={styles.pkg}>{entry.packageTitle}</span>
          <span className={styles.date}>{formatDateShort(entry.departureDate)}</span>
        </div>
        <div className={styles.statusCol}>
          {isLoading ? (
            <Skeleton width={84} height={22} radius="var(--radius-pill)" />
          ) : notFound ? (
            <span className={styles.unavailable}>No disponible</span>
          ) : booking ? (
            <StatusPill status={booking.status} />
          ) : null}
        </div>
      </button>
      {notFound && (
        <button type="button" className={styles.remove} onClick={onRemove}>
          Quitar
        </button>
      )}
    </li>
  );
}
