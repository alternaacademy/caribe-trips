import { usePackages } from '@/api/hooks';
import type { Package } from '@/api/types';
import { Destacados } from '@/components/Destacados';
import { DestinationChips } from '@/components/DestinationChips';
import { SearchField } from '@/components/SearchField';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { ErrorCard } from '@/mobile/ErrorCard';
import { Offline } from '@/mobile/Offline';
import { PullToRefresh } from '@/mobile/PullToRefresh';
import { isMobileShell } from '@/mobile/platform';
import { useOnline } from '@/mobile/useOnline';
import { EmptyState, MonthHeader, PackageCard, PackageCardSkeleton } from '@/ui';
import { MapPinIcon } from '@/ui/icons';
import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import { buildMonthGroups, totalDepartures } from './monthGroups';
import { useFilters } from './useFilters';

export function Home() {
  const navigate = useNavigate();
  const { destination, q, setDestination, setQ, reset } = useFilters();

  // Local input value is immediate; the debounced value drives the URL + query.
  const [text, setText] = useState(q);
  const debouncedText = useDebouncedValue(text, 300);
  useEffect(() => {
    if (debouncedText !== q) setQ(debouncedText);
  }, [debouncedText, q, setQ]);

  const { data: packages, isLoading, isError, refetch } = usePackages({ destination, q });
  const searching = q.trim().length > 0;
  const mobile = isMobileShell();
  const online = useOnline();

  const clearAll = () => {
    setText('');
    reset();
  };

  let body: ReactNode;
  if (mobile && !online) {
    body = <Offline onRetry={() => refetch()} />;
  } else if (isLoading) {
    body = <HomeSkeleton />;
  } else if (isError) {
    body = <ErrorCard onRetry={() => refetch()} />;
  } else if (packages) {
    body = (
      <HomeContent
        packages={packages}
        searching={searching}
        onOpen={(id) => navigate(`/packages/${id}`)}
        onReset={clearAll}
      />
    );
  }

  return (
    <>
      <section className={styles.intro}>
        <span className={styles.eyebrow}>
          <MapPinIcon size={14} />
          República Dominicana
        </span>
        <h1 className={styles.title}>
          Tu próximo <em>paraíso</em>, a un toque
        </h1>
      </section>

      <SearchField value={text} onChange={setText} onClear={clearAll} />
      <DestinationChips active={destination} onSelect={setDestination} />

      {mobile ? <PullToRefresh onRefresh={() => refetch()}>{body}</PullToRefresh> : body}
    </>
  );
}

function HomeContent({
  packages,
  searching,
  onOpen,
  onReset,
}: {
  packages: Package[];
  searching: boolean;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const featured = packages.filter((p) => p.featured);
  const groups = buildMonthGroups(packages);
  const total = totalDepartures(groups);

  if (packages.length === 0) {
    return (
      <EmptyState
        title="No encontramos paquetes para tu búsqueda."
        text="Prueba con otro destino o término."
        actionLabel="Ver todos los destinos"
        onAction={onReset}
      />
    );
  }

  return (
    <>
      {/* Destacados hides while a text search is active (reference behavior). */}
      {!searching && <Destacados packages={featured} />}

      <section className={styles.departures} aria-labelledby="departures-head">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle} id="departures-head">
            Próximas salidas
          </h2>
          <span className={styles.sectionMeta}>
            {total} {total === 1 ? 'salida' : 'salidas'}
          </span>
        </div>

        {groups.map((group) => (
          <div key={group.monthKey}>
            <MonthHeader label={group.label} count={group.items.length} />
            <div className={styles.monthList}>
              {group.items.map(({ pkg, departure }) => (
                <PackageCard
                  key={`${pkg.id}-${departure.date}`}
                  variant="row"
                  pkg={pkg}
                  departure={departure}
                  onOpen={() => pkg.id && onOpen(pkg.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function HomeSkeleton() {
  return (
    <section className={styles.departures} aria-hidden="true">
      <div className={styles.monthList}>
        {[0, 1, 2].map((i) => (
          <PackageCardSkeleton key={i} variant="row" />
        ))}
      </div>
    </section>
  );
}
