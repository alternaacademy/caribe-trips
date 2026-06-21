import { EmptyState } from '@/ui';
import { AlertIcon } from '@/ui/icons';

/** Retry card for a failed (non-offline) query. */
export function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="No pudimos cargar la información."
      text="Ocurrió un error al contactar el servidor."
      actionLabel="Reintentar"
      onAction={onRetry}
      icon={<AlertIcon size={28} />}
    />
  );
}
