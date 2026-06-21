import { useEffect, useState } from 'react';

/** Reactive online/offline status (browser `navigator.onLine` + events).
 *  On Android the WebView reports connectivity the same way. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}
