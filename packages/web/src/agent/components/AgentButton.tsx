import { Spinner } from '@/ui';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './AgentButton.module.css';

/** Backoffice button. Primary is GREEN here (coral is reserved for the
 *  customer brochure CTA). `sm` for in-row actions. */
export function AgentButton({
  variant = 'primary',
  size,
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm';
  loading?: boolean;
  children: ReactNode;
}) {
  const classes = [styles.btn, styles[variant], size === 'sm' && styles.sm, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} disabled={disabled || loading} type={type} {...rest}>
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
