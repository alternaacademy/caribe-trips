import { SparkIcon } from '@/ui/icons';
import { useRef } from 'react';
import styles from './IntentField.module.css';

const MAX_HEIGHT = 180;

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
}

const CHIPS = ['Viajamos con niños', 'Presupuesto ajustado', 'Aniversario', 'Algo activo'];

export interface IntentFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  minChars: number;
}

/** Submitting is explicit: a ~15 s model call must never fire on a typing pause. */
export function IntentField({ value, onChange, onSubmit, pending, minChars }: IntentFieldProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const tooShort = value.trim().length < minChars;

  const attach = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    fit(el);
  };

  const appendChip = (chip: string) => {
    onChange(value.trim().length > 0 ? `${value.trim()}. ${chip}` : chip);
    ref.current?.focus();
    requestAnimationFrame(() => fit(ref.current));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <textarea
          id="search-input"
          ref={attach}
          className={styles.input}
          rows={2}
          value={value}
          placeholder="Cuéntanos qué buscas: somos dos, nos gusta la naturaleza, tenemos un fin de semana y hasta RD$15,000 por persona…"
          aria-label="Cuéntanos qué viaje buscas"
          onChange={(e) => {
            onChange(e.target.value);
            fit(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!tooShort && !pending) onSubmit();
            }
          }}
        />
        <button
          type="button"
          className={styles.go}
          onClick={onSubmit}
          disabled={tooShort || pending}
        >
          <SparkIcon size={18} />
          <span>{pending ? 'Buscando…' : 'Recomiéndame'}</span>
        </button>
      </div>

      <div className={styles.chips}>
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={styles.chip}
            onClick={() => appendChip(chip)}
            disabled={pending}
          >
            + {chip}
          </button>
        ))}
      </div>

      <p className={styles.note}>Guardamos lo que escribes para mejorar las recomendaciones.</p>
    </div>
  );
}
