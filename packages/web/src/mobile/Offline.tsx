import { EmptyState } from '@/ui';
import { CloudOffIcon } from '@/ui/icons';

/** Full-screen "Sin conexión" state for a data route while offline. */
export function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Sin conexión"
      text="Revisa tu internet e inténtalo de nuevo."
      actionLabel="Reintentar"
      onAction={onRetry}
      icon={<CloudOffIcon size={28} />}
    />
  );
}
