import { HomeIcon, SearchIcon, TicketIcon } from '@/ui/icons';
import { NavLink } from 'react-router-dom';
import styles from './TabBar.module.css';

const TABS = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/buscar', label: 'Buscar', icon: SearchIcon, end: false },
  { to: '/mis-reservas', label: 'Mis reservas', icon: TicketIcon, end: false },
];

/** Bottom tab bar (Android shell). Active tab is green; honors `--safe-bottom`. */
export function TabBar() {
  return (
    <nav className={styles.tabbar} aria-label="Navegación inferior">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          <Icon size={22} />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
