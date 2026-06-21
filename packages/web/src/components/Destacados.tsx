import type { Package } from '@/api/types';
import { PackageCard } from '@/ui';
import { useNavigate } from 'react-router-dom';
import styles from './Destacados.module.css';

/** Featured packages in a horizontal scroll-snap carousel. */
export function Destacados({ packages }: { packages: Package[] }) {
  const navigate = useNavigate();
  if (packages.length === 0) return null;
  return (
    <section aria-labelledby="destacados-head">
      <div className={styles.head}>
        <h2 className={styles.title} id="destacados-head">
          Destacados
        </h2>
        <span className={styles.meta}>Desliza →</span>
      </div>
      <div className={styles.carousel}>
        {packages.map((pkg) => (
          <div key={pkg.id} className={styles.slide}>
            <PackageCard
              variant="featured"
              pkg={pkg}
              onOpen={() => navigate(`/packages/${pkg.id}`)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
