import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';
import styles from './Field.module.css';

interface WrapperProps {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}

function FieldWrapper({ id, label, helper, error, children }: WrapperProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={styles.error} id={`${id}-error`}>
          {error}
        </p>
      ) : helper ? (
        <p className={styles.helper}>{helper}</p>
      ) : null}
    </div>
  );
}

type FieldMeta = { id: string; label: string; helper?: string; error?: string };

// forwardRef so react-hook-form's `register()` ref attaches to the control.
export const TextField = forwardRef<
  HTMLInputElement,
  FieldMeta & InputHTMLAttributes<HTMLInputElement>
>(function TextField({ id, label, helper, error, ...rest }, ref) {
  return (
    <FieldWrapper id={id} label={label} helper={helper} error={error}>
      <input
        id={id}
        ref={ref}
        className={error ? `${styles.control} ${styles.invalid}` : styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
    </FieldWrapper>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ id, label, helper, error, ...rest }, ref) {
  return (
    <FieldWrapper id={id} label={label} helper={helper} error={error}>
      <textarea
        id={id}
        ref={ref}
        className={
          error
            ? `${styles.control} ${styles.textarea} ${styles.invalid}`
            : `${styles.control} ${styles.textarea}`
        }
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldWrapper>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  FieldMeta & SelectHTMLAttributes<HTMLSelectElement>
>(function SelectField({ id, label, helper, error, children, ...rest }, ref) {
  return (
    <FieldWrapper id={id} label={label} helper={helper} error={error}>
      <select
        id={id}
        ref={ref}
        className={error ? `${styles.control} ${styles.invalid}` : styles.control}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});
