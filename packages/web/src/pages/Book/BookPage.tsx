import { apiErrorMessage } from '@/api/errors';
import { useCreateBooking } from '@/api/hooks';
import { usePackage } from '@/api/hooks';
import type { Booking } from '@/api/types';
import { rememberBooking } from '@/lib/recentBookings';
import {
  Alert,
  EmptyState,
  Price,
  Skeleton,
  Stepper,
  StickyCta,
  TextField,
  formatDateShort,
} from '@/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Book.module.css';

interface ContactForm {
  name: string;
  phone: string;
  email: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function BookPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: pkg, isLoading, isError } = usePackage(id);
  const createBooking = useCreateBooking();

  const [departureDate, setDepartureDate] = useState('');
  const [people, setPeople] = useState(2);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ContactForm>({ mode: 'onChange' });

  if (isLoading) {
    return (
      <div className={styles.loading} aria-hidden="true">
        <Skeleton width="60%" height={22} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
      </div>
    );
  }
  if (isError || !pkg) {
    return (
      <EmptyState
        title="Paquete no encontrado"
        text="No se puede reservar este viaje."
        actionLabel="Volver a Inicio"
        onAction={() => navigate('/')}
      />
    );
  }

  const selected = pkg.departures.find((d) => d.date === departureDate);
  const total = selected ? selected.price * people : 0;
  const canSubmit = Boolean(selected) && isValid && !createBooking.isPending;

  const submit = handleSubmit((form) => {
    if (!selected) return;
    createBooking.mutate(
      {
        packageId: pkg.id ?? id,
        departureDate,
        people,
        contact: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
      },
      {
        onSuccess: (booking: Booking) => {
          // Hook point: record the booking device-locally (Android Task 25 reads it).
          rememberBooking({
            code: booking.code,
            packageTitle: pkg.title,
            departureDate: booking.departureDate,
          });
          navigate(`/booking/${booking.code}`);
        },
      },
    );
  });

  return (
    <form className={styles.book} onSubmit={submit} noValidate>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Reservar</p>
        <h1 className={styles.title}>{pkg.title}</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.heading}>Elige tu fecha de salida</h2>
        <fieldset className={styles.dates}>
          <legend className={styles.srOnly}>Fecha de salida</legend>
          {pkg.departures.map((departure) => {
            const active = departure.date === departureDate;
            return (
              <label
                key={departure.date}
                className={active ? `${styles.date} ${styles.dateOn}` : styles.date}
              >
                <input
                  className={styles.dateRadio}
                  type="radio"
                  name="departure"
                  value={departure.date}
                  checked={active}
                  onChange={() => setDepartureDate(departure.date)}
                />
                <span>{formatDateShort(departure.date)}</span>
                <Price amount={departure.price} />
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>¿Cuántas personas?</h2>
        <Stepper value={people} onChange={setPeople} min={1} max={12} label="Personas" />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Datos de contacto</h2>
        <div className={styles.fields}>
          <TextField
            id="name"
            label="Nombre"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name', { required: 'Ingresa tu nombre' })}
          />
          <TextField
            id="phone"
            label="Teléfono"
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone', { required: 'Ingresa tu teléfono' })}
          />
          <TextField
            id="email"
            label="Correo"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', {
              required: 'Ingresa tu correo',
              pattern: { value: EMAIL_RE, message: 'Correo inválido' },
            })}
          />
        </div>
      </section>

      <p className={styles.helper}>Te contactaremos para coordinar el pago.</p>

      {createBooking.isError && (
        <div className={styles.section}>
          <Alert tone="error" title="No se pudo reservar">
            {apiErrorMessage(createBooking.error)}
          </Alert>
        </div>
      )}

      <StickyCta
        amount={total}
        caption={selected ? 'Total a pagar' : 'Elige una fecha'}
        actionLabel="Confirmar reserva"
        onAction={() => submit()}
        loading={createBooking.isPending}
        disabled={!canSubmit}
      />
    </form>
  );
}
