import { useBookingByCode, usePackage } from '@/api/hooks';
import {
  Alert,
  Button,
  EmptyState,
  Price,
  Skeleton,
  StatusPill,
  destinationLabel,
  formatDateShort,
} from '@/ui';
import { CheckIcon } from '@/ui/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Confirmation.module.css';

export function ConfirmationPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { data: booking, isLoading, isError } = useBookingByCode(code);
  const { data: pkg } = usePackage(booking?.packageId ?? '');
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.loading} aria-hidden="true">
        <Skeleton width={88} height={88} radius="var(--radius-pill)" />
        <Skeleton width="60%" height={22} />
        <Skeleton width="100%" height={120} />
      </div>
    );
  }
  if (isError || !booking) {
    return (
      <EmptyState
        title="No encontramos esa reserva."
        text="Verifica el código e intenta de nuevo."
        actionLabel="Volver a Inicio"
        onAction={() => navigate('/')}
      />
    );
  }

  const confirmed = booking.status === 'Confirmada';

  const copy = () => {
    navigator.clipboard?.writeText(booking.code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className={styles.page}>
      <div className={confirmed ? `${styles.hero} ${styles.heroOk}` : styles.hero}>
        <span className={styles.medallion}>
          <CheckIcon size={32} />
        </span>
        <h1 className={styles.title}>{confirmed ? '¡Reserva confirmada!' : '¡Reserva creada!'}</h1>
        <StatusPill status={booking.status} />
      </div>

      <div className={styles.codeCard}>
        <span className={styles.codeLabel}>Código de reserva</span>
        <div className={styles.codeRow}>
          <span className={styles.code}>{booking.code}</span>
          <button type="button" className={styles.copy} onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      {confirmed ? (
        <div className={styles.section}>
          <Alert tone="success" title="Pago confirmado">
            Un agente confirmó tu pago. ¡Nos vemos pronto!
          </Alert>
        </div>
      ) : (
        <div className={styles.section}>
          <Alert tone="pending" title="Pago pendiente">
            Paga en la agencia o por transferencia bancaria. Un agente confirmará tu reserva.
          </Alert>
          <dl className={styles.bank}>
            <div className={styles.bankRow}>
              <dt>Banco</dt>
              <dd>Banco Popular</dd>
            </div>
            <div className={styles.bankRow}>
              <dt>Cuenta</dt>
              <dd>000-0000000-0</dd>
            </div>
            <div className={styles.bankRow}>
              <dt>Beneficiario</dt>
              <dd>Caribe Trips SRL</dd>
            </div>
          </dl>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.heading}>Resumen</h2>
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>Paquete</dt>
            <dd>{pkg?.title ?? '—'}</dd>
          </div>
          {pkg && (
            <div className={styles.summaryRow}>
              <dt>Destino</dt>
              <dd>{destinationLabel(pkg.destination)}</dd>
            </div>
          )}
          <div className={styles.summaryRow}>
            <dt>Fecha</dt>
            <dd>{formatDateShort(booking.departureDate)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Personas</dt>
            <dd>{booking.people}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Total</dt>
            <dd>
              <Price amount={booking.total} />
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
