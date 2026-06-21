import { Spinner } from '@/ui';
import { type ReactNode, useRef, useState } from 'react';
import styles from './PullToRefresh.module.css';

const THRESHOLD = 70;
const MAX = 110;

/** Native-style pull-to-refresh for a scroll-top list. Touch-driven (device);
 *  on a non-touch browser it simply renders its children. `onRefresh` should
 *  return a promise (e.g. `invalidateQueries`). */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const scroller = ref.current?.closest('.app__scroll') ?? document.scrollingElement;
    if ((scroller?.scrollTop ?? 0) <= 0 && !refreshing) startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta * 0.5, MAX));
  };
  const onTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const active = pull > 0 || refreshing;

  return (
    <div
      ref={ref}
      data-ptr=""
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {active && (
        <div className={styles.indicator} style={{ height: pull }} aria-hidden={!refreshing}>
          <span className={styles.spin} style={{ opacity: Math.min(1, pull / THRESHOLD) }}>
            <Spinner size={22} />
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
