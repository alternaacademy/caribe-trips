import { AgentButton, AgentScreen, useToast } from '@/agent/components';
import { useCreatePackage, usePackage, useUpdatePackage } from '@/api/hooks';
import type { Destination, NewPackage, Package } from '@/api/types';
import { Brochure } from '@/components/Brochure/Brochure';
import {
  DESTINATIONS,
  EmptyState,
  SelectField,
  Skeleton,
  TextArea,
  TextField,
  destinationLabel,
} from '@/ui';
import { useEffect } from 'react';
import {
  type UseFieldArrayReturn,
  type UseFormRegister,
  useFieldArray,
  useForm,
} from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './PackageEditor.module.css';

interface FormValues {
  title: string;
  destination: Destination;
  heroImage: string;
  gallery: { url: string }[];
  shortPitch: string;
  descriptionMd: string;
  included: { value: string }[];
  notIncluded: { value: string }[];
  departures: { date: string; price: number }[];
  featured: boolean;
}

const EMPTY: FormValues = {
  title: '',
  destination: 'PuntaCana',
  heroImage: '',
  gallery: [],
  shortPitch: '',
  descriptionMd: '',
  included: [],
  notIncluded: [],
  departures: [{ date: '', price: 0 }],
  featured: false,
};

function toFormValues(pkg: Package): FormValues {
  return {
    title: pkg.title,
    destination: pkg.destination,
    heroImage: pkg.heroImage,
    gallery: pkg.gallery.map((url) => ({ url })),
    shortPitch: pkg.shortPitch,
    descriptionMd: pkg.descriptionMd,
    included: pkg.included.map((value) => ({ value })),
    notIncluded: pkg.notIncluded.map((value) => ({ value })),
    departures: pkg.departures.map((d) => ({ date: d.date, price: d.price })),
    featured: pkg.featured,
  };
}

function toNewPackage(values: FormValues): NewPackage {
  return {
    title: values.title.trim(),
    destination: values.destination,
    heroImage: values.heroImage.trim(),
    gallery: values.gallery.map((g) => g.url.trim()).filter(Boolean),
    shortPitch: values.shortPitch.trim(),
    descriptionMd: values.descriptionMd,
    included: values.included.map((i) => i.value.trim()).filter(Boolean),
    notIncluded: values.notIncluded.map((i) => i.value.trim()).filter(Boolean),
    departures: values.departures
      .filter((d) => d.date)
      .map((d) => ({ date: d.date, price: Number(d.price) })),
    featured: values.featured,
  };
}

/** Build a display `Package` from form state for the live preview. */
function toDraft(values: FormValues, id?: string): Package {
  const np = toNewPackage(values);
  const priceFrom = np.departures.length ? Math.min(...np.departures.map((d) => d.price)) : 0;
  return { ...np, id: id ?? null, priceFrom };
}

export function PackageEditorPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: pkg, isLoading, isError } = usePackage(isNew ? '' : id);
  const createMutation = useCreatePackage();
  const updateMutation = useUpdatePackage();

  const { register, control, handleSubmit, reset, watch, formState } = useForm<FormValues>({
    defaultValues: EMPTY,
    mode: 'onChange',
  });

  const gallery = useFieldArray({ control, name: 'gallery' });
  const included = useFieldArray({ control, name: 'included' });
  const notIncluded = useFieldArray({ control, name: 'notIncluded' });
  const departures = useFieldArray({ control, name: 'departures' });

  // Hydrate edit mode once the package loads.
  useEffect(() => {
    if (!isNew && pkg) reset(toFormValues(pkg));
  }, [isNew, pkg, reset]);

  const values = watch();
  const draft = toDraft(values, isNew ? undefined : id);

  const validDepartures = draft.departures.length > 0 && draft.departures.every((d) => d.price > 0);
  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((data) => {
    if (!validDepartures) return;
    const payload = toNewPackage(data);
    const onSuccess = () => {
      toast(isNew ? 'Paquete creado.' : 'Paquete actualizado.');
      navigate('/agent/packages');
    };
    if (isNew) createMutation.mutate(payload, { onSuccess });
    else updateMutation.mutate({ id, body: payload }, { onSuccess });
  });

  if (!isNew && isLoading) {
    return (
      <AgentScreen title="Editar paquete">
        <Skeleton width="100%" height={320} />
      </AgentScreen>
    );
  }
  if (!isNew && (isError || !pkg)) {
    return (
      <AgentScreen title="Editar paquete">
        <EmptyState
          title="Paquete no encontrado"
          text="Es posible que ya no exista."
          actionLabel="Volver a Paquetes"
          onAction={() => navigate('/agent/packages')}
        />
      </AgentScreen>
    );
  }

  return (
    <AgentScreen title={isNew ? 'Nuevo paquete' : 'Editar paquete'}>
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextField
            id="title"
            label="Título"
            error={formState.errors.title?.message}
            {...register('title', { required: 'El título es obligatorio' })}
          />
          <SelectField id="destination" label="Destino" {...register('destination')}>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {destinationLabel(d)}
              </option>
            ))}
          </SelectField>
          <TextField id="heroImage" label="Imagen principal (URL)" {...register('heroImage')} />
          <TextField id="shortPitch" label="Frase corta" {...register('shortPitch')} />
          <TextArea
            id="descriptionMd"
            label="Descripción (markdown)"
            {...register('descriptionMd')}
          />

          <UrlGroup title="Galería" array={gallery} register={register} />
          <LineGroup title="Qué incluye" name="included" array={included} register={register} />
          <LineGroup
            title="No incluye"
            name="notIncluded"
            array={notIncluded}
            register={register}
          />

          <fieldset className={styles.group}>
            <legend className={styles.groupTitle}>Fechas de salida</legend>
            {departures.fields.map((field, i) => (
              <div key={field.id} className={styles.depRow}>
                <input
                  className={styles.depDate}
                  type="date"
                  aria-label="Fecha"
                  {...register(`departures.${i}.date`, { required: true })}
                />
                <input
                  className={styles.depPrice}
                  type="number"
                  min={1}
                  aria-label="Precio"
                  {...register(`departures.${i}.price`, { valueAsNumber: true, min: 1 })}
                />
                <AgentButton
                  variant="danger"
                  size="sm"
                  onClick={() => departures.remove(i)}
                  aria-label="Quitar salida"
                >
                  ✕
                </AgentButton>
              </div>
            ))}
            <AgentButton
              variant="secondary"
              size="sm"
              onClick={() => departures.append({ date: '', price: 0 })}
            >
              Agregar salida
            </AgentButton>
            {!validDepartures && (
              <p className={styles.fieldError}>
                Agrega al menos una salida con precio mayor a cero.
              </p>
            )}
          </fieldset>

          <label className={styles.featuredRow}>
            <input type="checkbox" {...register('featured')} />
            Destacado
          </label>
        </form>

        <aside className={styles.previewPane}>
          <span className={styles.previewLabel}>Vista previa</span>
          <div className={styles.previewFrame}>
            <Brochure pkg={draft} />
          </div>
        </aside>
      </div>

      <div className={styles.actions}>
        <AgentButton variant="ghost" onClick={() => navigate('/agent/packages')}>
          Cancelar
        </AgentButton>
        <AgentButton onClick={() => onSubmit()} loading={saving} disabled={!validDepartures}>
          Guardar
        </AgentButton>
      </div>
    </AgentScreen>
  );
}

function UrlGroup({
  title,
  array,
  register,
}: {
  title: string;
  array: UseFieldArrayReturn<FormValues, 'gallery', 'id'>;
  register: UseFormRegister<FormValues>;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{title}</legend>
      {array.fields.map((field, i) => (
        <div key={field.id} className={styles.lineRow}>
          <input
            className={styles.lineInput}
            aria-label={`${title} ${i + 1}`}
            {...register(`gallery.${i}.url`)}
          />
          <AgentButton
            variant="danger"
            size="sm"
            onClick={() => array.remove(i)}
            aria-label="Quitar"
          >
            ✕
          </AgentButton>
        </div>
      ))}
      <AgentButton variant="secondary" size="sm" onClick={() => array.append({ url: '' })}>
        Agregar
      </AgentButton>
    </fieldset>
  );
}

function LineGroup({
  title,
  name,
  array,
  register,
}: {
  title: string;
  name: 'included' | 'notIncluded';
  array: UseFieldArrayReturn<FormValues, 'included' | 'notIncluded', 'id'>;
  register: UseFormRegister<FormValues>;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{title}</legend>
      {array.fields.map((field, i) => (
        <div key={field.id} className={styles.lineRow}>
          <input
            className={styles.lineInput}
            aria-label={`${title} ${i + 1}`}
            {...register(`${name}.${i}.value`)}
          />
          <AgentButton
            variant="danger"
            size="sm"
            onClick={() => array.remove(i)}
            aria-label="Quitar"
          >
            ✕
          </AgentButton>
        </div>
      ))}
      <AgentButton variant="secondary" size="sm" onClick={() => array.append({ value: '' })}>
        Agregar
      </AgentButton>
    </fieldset>
  );
}
