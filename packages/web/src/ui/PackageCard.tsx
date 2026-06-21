import type { Package } from '@/api/types';
import { Badge } from './Badge';
import styles from './PackageCard.module.css';
import { Price } from './Price';
import { Skeleton } from './Skeleton';
import { destinationLabel, formatDateShort } from './format';
import { CalendarIcon } from './icons';

export interface PackageCardProps {
  pkg: Package;
  variant?: 'featured' | 'row';
  /** For `row` cards: the specific departure shown (date + its price). */
  departure?: { date: string; price: number };
  onOpen?: () => void;
}

/** Brochure card. `featured` = tall 4:3 hero with badge + "desde" price;
 *  `row` = compact 3:2 thumb with a departure date + price. A real `<button>`
 *  so keyboard activation + focus come for free. */
export function PackageCard({ pkg, variant = 'row', departure, onOpen }: PackageCardProps) {
  const rootClass = variant === 'featured' ? styles.featured : styles.row;
  return (
    <button
      type="button"
      className={`${styles.card} ${rootClass}`}
      aria-label={pkg.title}
      onClick={onOpen}
    >
      <div className={styles.media}>
        <img
          src={pkg.heroImage}
          alt={`${destinationLabel(pkg.destination)} — ${pkg.title}`}
          loading="lazy"
        />
        {variant === 'featured' && pkg.featured && <Badge />}
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{destinationLabel(pkg.destination)}</p>
        <h3 className={styles.title}>{pkg.title}</h3>
        {variant === 'featured' && <p className={styles.pitch}>{pkg.shortPitch}</p>}
        <div className={styles.foot}>
          {variant === 'row' && departure ? (
            <>
              <span className={styles.date}>
                <CalendarIcon size={15} />
                {formatDateShort(departure.date)}
              </span>
              <Price amount={departure.price} from />
            </>
          ) : (
            <Price amount={pkg.priceFrom} from />
          )}
        </div>
      </div>
    </button>
  );
}

/** Loading placeholder matching a card's footprint. */
export function PackageCardSkeleton({ variant = 'row' }: { variant?: 'featured' | 'row' }) {
  const rootClass = variant === 'featured' ? styles.featured : styles.row;
  return (
    <div className={`${styles.card} ${rootClass}`} aria-hidden="true">
      <div className={styles.media}>
        <Skeleton width="100%" height="100%" radius="0" />
      </div>
      <div className={styles.body}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="80%" height={18} />
        <div className={styles.foot}>
          <Skeleton width="50%" height={14} />
        </div>
      </div>
    </div>
  );
}
