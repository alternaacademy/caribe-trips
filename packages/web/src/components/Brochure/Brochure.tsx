import type { Package } from '@/api/types';
import { Gallery, IncludeItem, Price, StickyCta } from '@/ui';
import { destinationLabel, formatDateShort } from '@/ui';
import { ArrowLeftIcon, CalendarIcon } from '@/ui/icons';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import styles from './Brochure.module.css';
import prose from './prose.module.css';

export interface BrochureProps {
  pkg: Package;
  /** Back-arrow handler; omitted in the editor preview (Task 21). */
  onBack?: () => void;
  /** "Reservar" CTA handler; omitted in the editor preview. */
  onReserve?: () => void;
}

/** Presentational digital brochure. Pure — no data fetching — so the agent
 *  package editor (Task 21) can render it live from draft form state. */
export function Brochure({ pkg, onBack, onReserve }: BrochureProps) {
  const dest = destinationLabel(pkg.destination);
  return (
    <div className={styles.brochure}>
      <div className={styles.hero}>
        <img className={styles.heroImg} src={pkg.heroImage} alt={`${dest} — ${pkg.title}`} />
        {onBack && (
          <button className={styles.back} type="button" onClick={onBack} aria-label="Volver">
            <ArrowLeftIcon size={20} />
          </button>
        )}
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{dest}</p>
          <h1 className={styles.title}>{pkg.title}</h1>
        </div>
      </div>

      <div className={styles.facts}>
        <span className={styles.fact}>{dest}</span>
        <Price amount={pkg.priceFrom} from />
      </div>

      {pkg.gallery.length > 0 && (
        <div className={styles.gallery}>
          <Gallery images={pkg.gallery} alt={pkg.title} />
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.heading}>Sobre este viaje</h2>
        <div className={prose.prose}>
          <Markdown rehypePlugins={[rehypeSanitize]}>{pkg.descriptionMd}</Markdown>
        </div>
      </section>

      {(pkg.included.length > 0 || pkg.notIncluded.length > 0) && (
        <section className={styles.section}>
          <h2 className={styles.heading}>Qué incluye</h2>
          <ul className={styles.includes}>
            {pkg.included.map((item) => (
              <IncludeItem key={item} included>
                {item}
              </IncludeItem>
            ))}
            {pkg.notIncluded.map((item) => (
              <IncludeItem key={item} included={false}>
                {item}
              </IncludeItem>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.heading}>Fechas de salida</h2>
        <ul className={styles.departures}>
          {pkg.departures.map((departure) => (
            <li key={departure.date} className={styles.departure}>
              <span className={styles.departureDate}>
                <CalendarIcon size={16} />
                {formatDateShort(departure.date)}
              </span>
              <Price amount={departure.price} />
            </li>
          ))}
        </ul>
      </section>

      {onReserve && (
        <StickyCta
          amount={pkg.priceFrom}
          from
          caption="Precio por persona"
          actionLabel="Reservar"
          onAction={onReserve}
        />
      )}
    </div>
  );
}
