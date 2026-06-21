import { usePackage } from '@/api/hooks';
import { Brochure } from '@/components/Brochure/Brochure';
import { EmptyState, Skeleton } from '@/ui';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Package.module.css';

export function PackagePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: pkg, isLoading, isError } = usePackage(id);

  if (isLoading) {
    return (
      <div className={styles.loading} aria-hidden="true">
        <Skeleton width="100%" height={280} radius="0" />
        <div className={styles.loadingBody}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="80%" height={24} />
          <Skeleton width="100%" height={80} />
        </div>
      </div>
    );
  }

  if (isError || !pkg) {
    return (
      <EmptyState
        title="Paquete no encontrado"
        text="Es posible que ya no esté disponible."
        actionLabel="Volver a Inicio"
        onAction={() => navigate('/')}
      />
    );
  }

  return (
    <Brochure pkg={pkg} onBack={() => navigate(-1)} onReserve={() => navigate(`/book/${pkg.id}`)} />
  );
}
