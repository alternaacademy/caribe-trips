import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

/** On-brand button. `primary` = coral fill, `secondary` = green outline,
 *  `ghost` = text. 48px min target; disables while loading. */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], className].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || loading} type={type} {...rest}>
      {loading && <Spinner size={18} />}
      {children}
    </button>
  );
}
