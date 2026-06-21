import {
  AgentButton,
  AgentScreen,
  type Column,
  DataTable,
  Dialog,
  DialogActions,
  Toggle,
  useToast,
} from '@/agent/components';
import { useDeletePackage, usePackages } from '@/api/hooks';
import { updatePackage } from '@/api/packages';
import type { NewPackage, Package } from '@/api/types';
import { EmptyState, destinationLabel, formatRD } from '@/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Packages.module.css';

/** Strip server-managed fields (id, priceFrom) to get the PUT payload. */
function toNewPackage(pkg: Package): NewPackage {
  return {
    title: pkg.title,
    destination: pkg.destination,
    heroImage: pkg.heroImage,
    gallery: pkg.gallery,
    shortPitch: pkg.shortPitch,
    descriptionMd: pkg.descriptionMd,
    included: pkg.included,
    notIncluded: pkg.notIncluded,
    departures: pkg.departures,
    featured: pkg.featured,
  };
}

export function PackagesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: packages, isLoading } = usePackages();
  const deleteMutation = useDeletePackage();
  const [target, setTarget] = useState<Package | null>(null);

  // Optimistic "Destacado" toggle: flip the cache immediately, roll back on error.
  const toggleFeatured = useMutation({
    mutationFn: ({ id, body }: { id: string; body: NewPackage }) => updatePackage(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: ['packages'] });
      const snapshots = queryClient.getQueriesData<Package[]>({ queryKey: ['packages'] });
      for (const [key, data] of snapshots) {
        if (data) {
          queryClient.setQueryData(
            key,
            data.map((p) => (p.id === id ? { ...p, featured: body.featured } : p)),
          );
        }
      }
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast('No se pudo actualizar.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  });

  const onToggle = (pkg: Package, featured: boolean) => {
    if (!pkg.id) return;
    toggleFeatured.mutate({ id: pkg.id, body: { ...toNewPackage(pkg), featured } });
  };

  const onDelete = () => {
    if (!target?.id) return;
    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        toast('Paquete eliminado.');
        setTarget(null);
      },
      onError: () => {
        toast('No se pudo eliminar.');
        setTarget(null);
      },
    });
  };

  const list = packages ?? [];

  const columns: Column<Package>[] = [
    {
      key: 'thumb',
      header: '',
      cell: (p) => <img className={styles.thumb} src={p.heroImage} alt="" />,
    },
    {
      key: 'title',
      header: 'Paquete',
      mobileLabel: 'Paquete',
      cell: (p) => <span className={styles.name}>{p.title}</span>,
    },
    {
      key: 'dest',
      header: 'Destino',
      mobileLabel: 'Destino',
      cell: (p) => destinationLabel(p.destination),
    },
    {
      key: 'desde',
      header: 'Desde',
      align: 'right',
      mobileLabel: 'Desde',
      cell: (p) => <span className={styles.price}>{formatRD(p.priceFrom)}</span>,
    },
    {
      key: 'salidas',
      header: 'Salidas',
      align: 'center',
      mobileLabel: 'Salidas',
      cell: (p) => p.departures.length,
    },
    {
      key: 'featured',
      header: 'Destacado',
      align: 'center',
      mobileLabel: 'Destacado',
      cell: (p) => (
        <Toggle
          checked={p.featured}
          onChange={(next) => onToggle(p, next)}
          label={`Destacar ${p.title}`}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      mobileLabel: '',
      cell: (p) => (
        <div className={styles.actions}>
          <AgentButton
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/agent/packages/${p.id}`)}
          >
            Editar
          </AgentButton>
          <AgentButton variant="danger" size="sm" onClick={() => setTarget(p)}>
            Eliminar
          </AgentButton>
        </div>
      ),
    },
  ];

  return (
    <AgentScreen
      title="Paquetes"
      meta={isLoading ? '…' : `${list.length} paquetes`}
      action={
        <AgentButton onClick={() => navigate('/agent/packages/new')}>Nuevo paquete</AgentButton>
      }
    >
      {isLoading ? (
        <div className={styles.loading}>Cargando paquetes…</div>
      ) : list.length === 0 ? (
        <EmptyState
          title="Crea tu primer paquete."
          text="Tus paquetes aparecerán aquí."
          actionLabel="Nuevo paquete"
          onAction={() => navigate('/agent/packages/new')}
        />
      ) : (
        <DataTable columns={columns} data={list} rowKey={(p) => p.id ?? p.title} />
      )}

      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Eliminar paquete">
        <p className={styles.confirmBody}>
          ¿Eliminar <span className={styles.name}>{target?.title}</span>? Esta acción no se puede
          deshacer.
        </p>
        <DialogActions>
          <AgentButton variant="ghost" onClick={() => setTarget(null)}>
            Cancelar
          </AgentButton>
          <AgentButton variant="danger" onClick={onDelete} loading={deleteMutation.isPending}>
            Eliminar
          </AgentButton>
        </DialogActions>
      </Dialog>
    </AgentScreen>
  );
}
