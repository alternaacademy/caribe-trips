import { MobileBack } from '@/mobile/MobileBack';
import { OfflineBanner } from '@/mobile/OfflineBanner';
import { TabBar } from '@/mobile/TabBar';
import { isMobileShell } from '@/mobile/platform';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// Routes that show the bottom tab bar; deep screens hide it (brochure/book/
// confirmation use a back affordance instead).
const TOP_LEVEL = new Set(['/', '/buscar', '/mis-reservas']);

/** Customer phone-frame shell: the `.app` column with a sticky app-bar that
 *  elevates on scroll, over a scrollable `.app__scroll` rendering the route.
 *  On the Android build it also gets the bottom tab bar + offline banner. */
export function AppLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const mobile = isMobileShell();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="app-stage">
      <div className="app">
        {mobile && <OfflineBanner />}
        <header className={scrolled ? 'app-bar is-scrolled' : 'app-bar'}>
          <p className="app-bar__brand">
            Caribe<span>·</span>Trips
          </p>
          <button
            className="icon-btn"
            type="button"
            aria-label="Buscar"
            onClick={() => document.getElementById('search-input')?.focus()}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </header>
        <div className="app__scroll" ref={scrollRef}>
          <Outlet />
        </div>
        {mobile && TOP_LEVEL.has(pathname) && <TabBar />}
      </div>
      {mobile && <MobileBack />}
    </div>
  );
}
