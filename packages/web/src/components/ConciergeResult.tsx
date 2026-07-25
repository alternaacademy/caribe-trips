import { LOW_CONFIDENCE, type Recommendation } from '@/api/recommend';
import { PackageCard, PackageCardSkeleton, Skeleton } from '@/ui';
import { SparkIcon } from '@/ui/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ConciergeResult.module.css';

/** After this many seconds the wait stops being "normal" and the panel says so. */
const SLOW_AFTER_S = 20;

/** Names the panel as a landmark, so it is reachable (and assertable) on its own. */
const PANEL_LABEL = 'Asesor de viajes';

export function ConciergeSkeleton({ onCancel }: { onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const slow = elapsed >= SLOW_AFTER_S;

  return (
    <section className={styles.panel} aria-label={PANEL_LABEL} aria-busy="true">
      <p className={styles.eyebrow}>
        <SparkIcon size={15} /> Buscando tu experiencia…
      </p>
      <Skeleton width="70%" height={22} />
      <div className={styles.heroSlot}>
        <PackageCardSkeleton variant="featured" />
      </div>
      <Skeleton width="90%" height={14} />
      <p className={styles.wait} aria-live="polite">
        {slow
          ? `Está tardando más de lo normal (${elapsed} s). Puedes seguir explorando mientras tanto.`
          : `Puede tomar hasta medio minuto: el asesor está leyendo todo el catálogo. (${elapsed} s)`}
      </p>
      <button type="button" className={styles.retry} onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}

export type ConciergeFailure = 'unavailable' | 'timeout' | 'confused';

const FAILURE_COPY: Record<ConciergeFailure, { title: string; body: string; action: string }> = {
  unavailable: {
    title: 'Asesor no disponible',
    body: 'No pudimos conectar con el asesor en este momento. Puedes explorar los destinos y las próximas salidas más abajo.',
    action: 'Reintentar',
  },
  timeout: {
    title: 'El asesor tardó demasiado',
    body: 'La consulta tomó más de lo esperado y la cancelamos. Puedes intentarlo otra vez o explorar el catálogo más abajo.',
    action: 'Intentar de nuevo',
  },
  confused: {
    title: 'No pudimos armar una recomendación',
    body: 'El asesor no logró elegir una experiencia para lo que escribiste. Prueba contándonos un poco más — fechas, presupuesto o con quién viajas.',
    action: 'Ajustar mi búsqueda',
  },
};

export function ConciergeUnavailable({
  failure,
  onRetry,
}: {
  failure: ConciergeFailure;
  onRetry: () => void;
}) {
  const copy = FAILURE_COPY[failure];
  return (
    <section className={styles.panel} aria-label={PANEL_LABEL}>
      <p className={styles.eyebrow}>
        <SparkIcon size={15} /> {copy.title}
      </p>
      <p className={styles.offline}>{copy.body}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {copy.action}
      </button>
    </section>
  );
}

export function ConciergeResult({
  result,
  onRefine,
}: {
  result: Recommendation;
  onRefine: () => void;
}) {
  const navigate = useNavigate();
  const open = (id?: string | null) => id && navigate(`/packages/${id}`);
  const unsure = !result.fits;
  const shaky = result.fits && result.confidence < LOW_CONFIDENCE;

  return (
    <section className={styles.panel} aria-label={PANEL_LABEL} aria-live="polite">
      <p className={styles.eyebrow}>
        <SparkIcon size={15} />
        {unsure ? 'Nada encaja del todo' : 'Nuestra recomendación'}
      </p>

      {unsure && (
        <p className={styles.caveat}>
          No tenemos una experiencia que cumpla exactamente lo que buscas. Esto es lo más cercano
          del catálogo.
        </p>
      )}
      {shaky && <p className={styles.caveat}>No estamos del todo seguros de esta elección.</p>}

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

      <p className={styles.refine}>
        ¿No es lo que buscabas?{' '}
        <button type="button" className={styles.link} onClick={onRefine}>
          Cuéntanos más
        </button>
      </p>
    </section>
  );
}
