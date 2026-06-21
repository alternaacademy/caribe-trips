import {
  AgentButton,
  AgentScreen,
  AgentSearch,
  AgentSelect,
  AgentStatusPill,
  type Column,
  Counter,
  Counters,
  DataTable,
  Dialog,
  DialogActions,
  FilterBar,
  FilterClear,
  Segmented,
  useToast,
} from '@/agent/components';
import { ApiError } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useBookings, useConfirmBooking, usePackages } from '@/api/hooks';
import type { Booking, BookingStatus, Package } from '@/api/types';
import {
  EmptyState,
  destinationLabel,
  formatDateShort,
  formatMonth,
  formatRD,
  monthKey,
} from '@/ui';
import { DESTINATIONS } from '@/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import styles from './Bookings.module.css';

type EstadoFilter = 'Todas' | BookingStatus;

export function BookingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: all, isLoading } = useBookings();
  const { data: packages } = usePackages();
  const confirmMutation = useConfirmBooking();
  const [target, setTarget] = useState<Booking | null>(null);

  const [estado, setEstado] = useState<EstadoFilter>('Todas');
  const [destino, setDestino] = useState('');
  const [mes, setMes] = useState('');
  const [search, setSearch] = useState('');

  const pkgMap = useMemo(
    () => new Map((packages ?? []).map((p) => [p.id ?? '', p] as const)),
    [packages],
  );

  const bookings = all ?? [];
  const pending = bookings.filter((b) => b.status === 'Pendiente').length;
  const confirmed = bookings.filter((b) => b.status === 'Confirmada').length;

  // Month options derived from departures.
  const months = useMemo(() => {
    const keys = [...new Set(bookings.map((b) => monthKey(b.departureDate)))].sort();
    return keys.map((key) => ({ key, label: formatMonth(`${key}-01`) }));
  }, [bookings]);

  const filtered = bookings.filter((b) => {
    if (estado !== 'Todas' && b.status !== estado) return false;
    if (destino && pkgMap.get(b.packageId)?.destination !== destino) return false;
    if (mes && monthKey(b.departureDate) !== mes) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const pkg = pkgMap.get(b.packageId);
      const haystack = `${b.code} ${b.contact.name} ${pkg?.title ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const anyFilter = estado !== 'Todas' || destino !== '' || mes !== '' || search.trim() !== '';
  const clearFilters = () => {
    setEstado('Todas');
    setDestino('');
    setMes('');
    setSearch('');
  };

  const doConfirm = () => {
    if (!target?.id) return;
    confirmMutation.mutate(target.id, {
      onSuccess: () => {
        toast('Pago confirmado.');
        setTarget(null);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          toast('La reserva ya estaba confirmada.');
        } else {
          toast(apiErrorMessage(error));
        }
        // Re-sync regardless so the row reflects server truth.
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        setTarget(null);
      },
    });
  };

  const columns: Column<Booking>[] = [
    {
      key: 'code',
      header: 'Código',
      mobileLabel: 'Código',
      cell: (b) => <span className={styles.code}>{b.code}</span>,
    },
    {
      key: 'pkg',
      header: 'Paquete',
      mobileLabel: 'Paquete',
      cell: (b) => <PackageCell pkg={pkgMap.get(b.packageId)} />,
    },
    {
      key: 'salida',
      header: 'Salida',
      mobileLabel: 'Salida',
      cell: (b) => formatDateShort(b.departureDate),
    },
    {
      key: 'personas',
      header: 'Personas',
      align: 'center',
      mobileLabel: 'Personas',
      cell: (b) => b.people,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      mobileLabel: 'Total',
      cell: (b) => <span className={styles.total}>{formatRD(b.total)}</span>,
    },
    {
      key: 'contacto',
      header: 'Contacto',
      mobileLabel: 'Contacto',
      cell: (b) => (
        <div className={styles.contact}>
          <span className={styles.contactName}>{b.contact.name}</span>
          <a className={styles.tel} href={`tel:${b.contact.phone}`}>
            {b.contact.phone}
          </a>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      mobileLabel: 'Estado',
      cell: (b) => <AgentStatusPill status={b.status} />,
    },
    {
      key: 'accion',
      header: 'Acción',
      align: 'right',
      mobileLabel: '',
      cell: (b) =>
        b.status === 'Pendiente' ? (
          <AgentButton size="sm" onClick={() => setTarget(b)}>
            Confirmar pago
          </AgentButton>
        ) : (
          <span className={styles.paid}>✓ Pagado</span>
        ),
    },
  ];

  return (
    <AgentScreen
      title="Reservas"
      meta={isLoading ? '…' : `${filtered.length} de ${bookings.length}`}
    >
      <Counters>
        <Counter tone="pending" label="Pendientes" value={pending} />
        <Counter tone="ok" label="Confirmadas" value={confirmed} />
        <Counter tone="month" label="Reservas" value={bookings.length} />
      </Counters>

      <FilterBar>
        <Segmented
          label="Estado"
          value={estado}
          onChange={(v) => setEstado(v as EstadoFilter)}
          options={[
            { value: 'Todas', label: 'Todas' },
            { value: 'Pendiente', label: 'Pendiente' },
            { value: 'Confirmada', label: 'Confirmada' },
          ]}
        />
        <AgentSelect label="Destino" value={destino} onChange={setDestino} active={destino !== ''}>
          <option value="">Todos los destinos</option>
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>
              {destinationLabel(d)}
            </option>
          ))}
        </AgentSelect>
        <AgentSelect label="Mes" value={mes} onChange={setMes} active={mes !== ''}>
          <option value="">Todos los meses</option>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </AgentSelect>
        <AgentSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por código, nombre o paquete"
        />
        {anyFilter && <FilterClear onClick={clearFilters} />}
      </FilterBar>

      {isLoading ? (
        <div className={styles.loading}>Cargando reservas…</div>
      ) : bookings.length === 0 ? (
        <EmptyState
          title="Aún no hay reservas."
          text="Las reservas de los clientes aparecerán aquí."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin coincidencias"
          text="Ajusta los filtros o limpia la búsqueda."
          actionLabel="Limpiar filtros"
          onAction={clearFilters}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(b) => b.id ?? b.code}
          rowClassName={(b) => (b.status === 'Pendiente' ? styles.rowPending : styles.rowConfirmed)}
        />
      )}

      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Confirmar pago">
        {target && (
          <p className={styles.confirmBody}>
            ¿Confirmas que recibiste el pago de{' '}
            <span className={styles.amount}>{formatRD(target.total)}</span> de{' '}
            <span className={styles.name}>{target.contact.name}</span>?
          </p>
        )}
        <DialogActions>
          <AgentButton variant="ghost" onClick={() => setTarget(null)}>
            Cancelar
          </AgentButton>
          <AgentButton onClick={doConfirm} loading={confirmMutation.isPending}>
            Confirmar pago
          </AgentButton>
        </DialogActions>
      </Dialog>
    </AgentScreen>
  );
}

function PackageCell({ pkg }: { pkg?: Package }) {
  return (
    <div className={styles.pkg}>
      {pkg && <img className={styles.thumb} src={pkg.heroImage} alt="" />}
      <div className={styles.pkgText}>
        <span className={styles.pkgName}>{pkg?.title ?? '—'}</span>
        {pkg && <span className={styles.pkgDest}>{destinationLabel(pkg.destination)}</span>}
      </div>
    </div>
  );
}
