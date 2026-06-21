import { useBookings } from '@/api/hooks';
import { NavLink, Outlet } from 'react-router-dom';
import styles from './AgentLayout.module.css';
import { ToastProvider } from './components/Toast';

/** Backoffice frame: left rail (desktop) / top tabs (mobile) + main outlet.
 *  Quiet, dense, Inter-led — distinct from the customer brochure. */
export function AgentLayout() {
  const { data: bookings } = useBookings();
  const pending = bookings?.filter((b) => b.status === 'Pendiente').length ?? 0;

  return (
    <ToastProvider>
      <div className={styles.root}>
        <div className={styles.shell}>
          <nav className={styles.nav} aria-label="Navegación principal">
            <div className={styles.brand}>
              Caribe<span className={styles.dot}>·</span>Trips
            </div>
            <div className={styles.group}>
              <span className={styles.label}>Operación</span>
              <NavLink
                to="/agent/bookings"
                className={({ isActive }) =>
                  isActive ? `${styles.item} ${styles.active}` : styles.item
                }
              >
                <BookingsIcon />
                Reservas
                {pending > 0 && <span className={styles.badge}>{pending}</span>}
              </NavLink>
              <NavLink
                to="/agent/packages"
                className={({ isActive }) =>
                  isActive ? `${styles.item} ${styles.active}` : styles.item
                }
              >
                <PackagesIcon />
                Paquetes
              </NavLink>
            </div>
          </nav>
          <main className={styles.main}>
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function BookingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" />
      <path d="M14 5v14" />
    </svg>
  );
}

function PackagesIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 3 7l9 5 9-5-9-5Z" />
      <path d="M3 7v10l9 5 9-5V7" />
      <path d="M12 12v10" />
    </svg>
  );
}
