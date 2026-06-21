import type { Package } from '@/api/types';
import {
  Alert,
  Badge,
  Button,
  Chip,
  EmptyState,
  Gallery,
  IncludeItem,
  MonthHeader,
  PackageCard,
  PackageCardSkeleton,
  Price,
  SelectField,
  Skeleton,
  Spinner,
  StatusPill,
  Stepper,
  TextArea,
  TextField,
} from '@/ui';
import { useState } from 'react';
import styles from './UiKit.module.css';

const IMG =
  'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=800&q=80&auto=format&fit=crop';

const DEMO_PKG: Package = {
  id: 'demo',
  title: 'Escapada a Samaná',
  destination: 'Samana',
  heroImage: IMG,
  gallery: [IMG, IMG],
  shortPitch: 'Tres días entre montañas verdes, playas vírgenes y el Cayo Levantado.',
  descriptionMd: '',
  included: [],
  notIncluded: [],
  departures: [{ date: '2026-06-14', price: 24900 }],
  priceFrom: 24900,
  featured: true,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.row}>{children}</div>
    </section>
  );
}

/** Dev-only visual catalog of every UI primitive + its states (Task 11). */
export function UiKit() {
  const [people, setPeople] = useState(2);
  const [active, setActive] = useState('Samaná');

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>UI Kit</h1>

      <Section title="Buttons">
        <Button variant="primary">Reservar</Button>
        <Button variant="secondary">Ver detalle</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="primary" disabled>
          Deshabilitado
        </Button>
        <Button variant="primary" loading>
          Cargando
        </Button>
      </Section>

      <Section title="Chips">
        {['Todos', 'Punta Cana', 'Samaná', 'Bayahíbe'].map((label) => (
          <Chip
            key={label}
            label={label}
            active={active === label}
            onClick={() => setActive(label)}
          />
        ))}
      </Section>

      <Section title="Badge / StatusPill / Price">
        <Badge />
        <StatusPill status="Pendiente" />
        <StatusPill status="Confirmada" />
        <Price amount={24900} from />
        <Price amount={49800} />
      </Section>

      <Section title="PackageCard — featured">
        <div className={styles.cardCol}>
          <PackageCard variant="featured" pkg={DEMO_PKG} />
        </div>
      </Section>

      <Section title="PackageCard — row + skeletons">
        <div className={styles.cardCol}>
          <PackageCard
            variant="row"
            pkg={DEMO_PKG}
            departure={{ date: '2026-06-14', price: 24900 }}
          />
          <PackageCardSkeleton variant="row" />
        </div>
      </Section>

      <Section title="MonthHeader">
        <div className={styles.fullCol}>
          <MonthHeader label="Junio 2026" count={3} />
        </div>
      </Section>

      <Section title="Fields">
        <div className={styles.formCol}>
          <TextField
            id="name"
            label="Nombre"
            placeholder="María Pérez"
            helper="Como aparece en tu cédula"
          />
          <TextField id="email" label="Correo" error="Correo inválido" defaultValue="malo@" />
          <SelectField id="dest" label="Destino">
            <option>Punta Cana</option>
            <option>Samaná</option>
          </SelectField>
          <TextArea id="notes" label="Notas" placeholder="Markdown del paquete…" />
          <div>
            <span className={styles.label}>Personas</span>
            <Stepper value={people} onChange={setPeople} />
          </div>
        </div>
      </Section>

      <Section title="Gallery">
        <div className={styles.cardCol}>
          <Gallery images={[IMG, IMG, IMG]} alt="Samaná" />
        </div>
      </Section>

      <Section title="IncludeItem">
        <ul className={styles.fullCol}>
          <IncludeItem included>2 noches de alojamiento</IncludeItem>
          <IncludeItem included={false}>Vuelos</IncludeItem>
        </ul>
      </Section>

      <Section title="Alerts">
        <div className={styles.fullCol}>
          <Alert tone="success" title="Pago confirmado">
            La reserva está confirmada.
          </Alert>
          <Alert tone="pending" title="Pago pendiente">
            Paga en agencia o por transferencia.
          </Alert>
          <Alert tone="error" title="No se pudo reservar">
            Revisa los datos e intenta de nuevo.
          </Alert>
        </div>
      </Section>

      <Section title="Spinner / Skeleton / EmptyState">
        <Spinner />
        <Skeleton width={160} height={16} />
        <div className={styles.fullCol}>
          <EmptyState
            title="Sin resultados"
            text="No encontramos paquetes para tu búsqueda."
            actionLabel="Ver todos"
          />
        </div>
      </Section>
    </div>
  );
}
