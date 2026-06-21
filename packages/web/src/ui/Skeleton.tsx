import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

/** Shimmering placeholder block. */
export function Skeleton({
  width,
  height,
  radius = 'var(--radius-md)',
}: {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: string;
}) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} />;
}
