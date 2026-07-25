import type { Recommendation } from '@/api/recommend';
import { PackageCard, PackageCardSkeleton, Skeleton } from '@/ui';
import { SparkIcon } from '@/ui/icons';
import { useNavigate } from 'react-router-dom';
import styles from './ConciergeResult.module.css';

export function ConciergeSkeleton() {
  return (
    <section className={styles.panel} aria-busy="true">
      <p className={styles.eyebrow}>
        <SparkIcon size={15} /> Buscando tu experiencia…
      </p>
      <Skeleton width="70%" height={22} />
      <div className={styles.heroSlot}>
        <PackageCardSkeleton variant="featured" />
      </div>
      <Skeleton width="90%" height={14} />
      <p className={styles.wait}>
        Puede tomar hasta medio minuto: el asesor está leyendo todo el catálogo.
      </p>
    </section>
  );
}

/** Shown when the model is unreachable. Browsing below still works, so this is
 *  a note rather than an error screen. */
export function ConciergeUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className={styles.panel}>
      <p className={styles.eyebrow}>
        <SparkIcon size={15} /> Asesor no disponible
      </p>
      <p className={styles.offline}>
        No pudimos consultar al asesor en este momento. Puedes explorar los destinos y las próximas
        salidas más abajo.
      </p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Reintentar
      </button>
    </section>
  );
}

export function ConciergeResult({ result }: { result: Recommendation }) {
  const navigate = useNavigate();
  const open = (id?: string | null) => id && navigate(`/packages/${id}`);

  return (
    <section className={styles.panel} aria-live="polite">
      <p className={styles.eyebrow}>
        <SparkIcon size={15} /> Nuestra recomendación
      </p>
      <h2 className={styles.headline}>{result.headline}</h2>

      <div className={styles.heroSlot}>
        <PackageCard
          variant="featured"
          pkg={result.package}
          onOpen={() => open(result.package.id)}
        />
      </div>

      <p className={styles.why}>{result.why}</p>
      {result.considerations && <p className={styles.considerations}>{result.considerations}</p>}

      {result.alsoConsider.length > 0 && (
        <div className={styles.also}>
          <p className={styles.alsoHead}>También podrían gustarte</p>
          <ul className={styles.alsoList}>
            {result.alsoConsider.map((pkg) => (
              <li key={pkg.id}>
                <button type="button" className={styles.alt} onClick={() => open(pkg.id)}>
                  <img className={styles.altImg} src={pkg.heroImage} alt="" loading="lazy" />
                  <span className={styles.altText}>
                    <span className={styles.altTitle}>{pkg.title}</span>
                    <span className={styles.altPrice}>
                      desde RD${pkg.priceFrom.toLocaleString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
