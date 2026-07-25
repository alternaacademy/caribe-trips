import { usePackages, useRecommend } from '@/api/hooks';
import type { Package } from '@/api/types';
import {
  ConciergeResult,
  ConciergeSkeleton,
  ConciergeUnavailable,
} from '@/components/ConciergeResult';
import { Destacados } from '@/components/Destacados';
import { DestinationChips } from '@/components/DestinationChips';
import { IntentField } from '@/components/IntentField';
import { ErrorCard } from '@/mobile/ErrorCard';
import { Offline } from '@/mobile/Offline';
import { PullToRefresh } from '@/mobile/PullToRefresh';
import { isMobileShell } from '@/mobile/platform';
import { useOnline } from '@/mobile/useOnline';
import { EmptyState, MonthHeader, PackageCard, PackageCardSkeleton } from '@/ui';
import { MapPinIcon } from '@/ui/icons';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import { buildMonthGroups, totalDepartures } from './monthGroups';
import { useFilters } from './useFilters';

/** Matches MIN_INTENT_CHARS on the API. */
const MIN_INTENT = 10;

export function Home() {
  const navigate = useNavigate();
  const { destination, setDestination, reset } = useFilters();

  const [intent, setIntent] = useState('');
  const concierge = useRecommend();

  const { data: packages, isLoading, isError, refetch } = usePackages({ destination });
  const mobile = isMobileShell();
  const online = useOnline();

  const askConcierge = () => {
    const text = intent.trim();
    if (text.length >= MIN_INTENT) concierge.mutate(text);
  };

  const clearAll = () => {
    setIntent('');
    concierge.reset();
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
          El Caribe
        </span>
        <h1 className={styles.title}>
          Tu próximo <em>paraíso</em>, a un toque
        </h1>
      </section>

      <IntentField
        value={intent}
        onChange={setIntent}
        onSubmit={askConcierge}
        pending={concierge.isPending}
        minChars={MIN_INTENT}
      />

      {concierge.isPending && <ConciergeSkeleton />}
      {concierge.isError && <ConciergeUnavailable onRetry={askConcierge} />}
      {concierge.isSuccess && !concierge.isPending && <ConciergeResult result={concierge.data} />}

      <DestinationChips active={destination} onSelect={setDestination} />

      {mobile ? <PullToRefresh onRefresh={() => refetch()}>{body}</PullToRefresh> : body}
    </>
  );
}

function HomeContent({
  packages,
  onOpen,
  onReset,
}: {
  packages: Package[];
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
      <Destacados packages={featured} />

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
