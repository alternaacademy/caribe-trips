import { type ReactNode, useEffect, useId, useRef } from 'react';
import styles from './Dialog.module.css';

/** Generic modal built on the native `<dialog>` element: the browser provides
 *  the focus trap and Esc-to-close; backdrop click closes too. Shared by
 *  confirm-payment (Task 19) and delete-package (Task 20). */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> handles Esc; onClick only closes on backdrop.
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      // Esc fires `close`; route it through onClose to keep React state in sync.
      onClose={onClose}
      // Backdrop click: the event target is the <dialog> itself (content is nested).
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <h2 className={styles.title} id={titleId}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

/** Standard dialog action row. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
