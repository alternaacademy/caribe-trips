import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  /** Label shown before the cell when the table collapses to cards (≤640px). */
  mobileLabel?: string;
  cell: (row: T) => ReactNode;
}

/** Generic dense table: sticky header, zebra rows, collapses to stacked cards
 *  under 640px (mobile labels from each column). */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  rowClassName,
}: {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
}) {
  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? styles.num : align === 'center' ? styles.ctr : undefined;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={alignClass(col.align)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const extra = rowClassName?.(row);
            return (
              <tr key={rowKey(row)} className={extra ? `${styles.row} ${extra}` : styles.row}>
                {columns.map((col) => (
                  <td key={col.key} className={alignClass(col.align)}>
                    {col.mobileLabel && (
                      <span className={styles.mobileLabel}>{col.mobileLabel}</span>
                    )}
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
