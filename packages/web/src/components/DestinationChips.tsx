import type { Destination } from '@/api/types';
import { Chip, DESTINATIONS, destinationLabel } from '@/ui';
import styles from './DestinationChips.module.css';

/** Single-select destination filter row. "Todos" (no selection) is the default. */
export function DestinationChips({
  active,
  onSelect,
}: {
  active?: Destination;
  onSelect: (destination?: Destination) => void;
}) {
  return (
    <nav className={styles.chips} aria-label="Filtrar por destino">
      <Chip label="Todos" active={!active} onClick={() => onSelect(undefined)} />
      {DESTINATIONS.map((destination) => (
        <Chip
          key={destination}
          label={destinationLabel(destination)}
          active={active === destination}
          onClick={() => onSelect(destination)}
        />
      ))}
    </nav>
  );
}
