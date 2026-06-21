import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './Toast.module.css';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Provides `useToast()` and renders the live-region toast. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <output
        className={message ? `${styles.toast} ${styles.on}` : styles.toast}
        aria-live="polite"
      >
        {message}
      </output>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
