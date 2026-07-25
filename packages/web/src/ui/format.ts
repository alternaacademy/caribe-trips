import type { Destination } from '@/api/types';

/** Spanish (DR) display formatters. Dates/prices appear on nearly every screen,
 *  so these are the single source of truth — components never format inline. */

const RD_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const SHORT_DATE = new Intl.DateTimeFormat('es-DO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const LONG_MONTH = new Intl.DateTimeFormat('es-DO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `24900` → `RD$24,900`. */
export function formatRD(amount: number): string {
  return `RD$${RD_NUMBER.format(Math.round(amount))}`;
}

/** ISO date (`2026-06-14`) → `Dom 14 jun 2026` (weekday is the real calendar
 *  weekday — the briefs' hardcoded mock weekdays are not calendar-accurate). */
export function formatDateShort(iso: string): string {
  const parts = SHORT_DATE.formatToParts(parseIsoDate(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekday = capitalize(stripDot(part('weekday')));
  const month = stripDot(part('month'));
  return `${weekday} ${part('day')} ${month} ${part('year')}`;
}

/** ISO date (`2026-06-14`) → `Junio 2026`. */
export function formatMonth(iso: string): string {
  const parts = LONG_MONTH.formatToParts(parseIsoDate(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${capitalize(part('month'))} ${part('year')}`;
}

/** A sortable month key (`2026-06`) for grouping departures chronologically. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const DESTINATION_LABELS: Record<Destination, string> = {
  PuntaCana: 'Punta Cana',
  Samana: 'Samaná',
  Bayahibe: 'Bayahíbe',
  LaRomana: 'La Romana',
  Constanza: 'Constanza',
  Jarabacoa: 'Jarabacoa',
  PuertoPlata: 'Puerto Plata',
  Barahona: 'Barahona',
  Habana: 'La Habana',
  Varadero: 'Varadero',
  SanJuan: 'San Juan',
  Vieques: 'Vieques',
  MontegoBay: 'Montego Bay',
  Negril: 'Negril',
  PortAuPrince: 'Puerto Príncipe',
  Nassau: 'Nassau',
  Exuma: 'Exuma',
  ProvidencialesTC: 'Providenciales',
  Aruba: 'Aruba',
  Curazao: 'Curazao',
  Barbados: 'Barbados',
  SantaLucia: 'Santa Lucía',
  Granada: 'Granada',
  Martinica: 'Martinica',
  Guadalupe: 'Guadalupe',
  SanMartin: 'San Martín',
  Dominica: 'Dominica',
  Antigua: 'Antigua',
  Tobago: 'Tobago',
  Cartagena: 'Cartagena',
  SanAndres: 'San Andrés',
  Roatan: 'Roatán',
  Belice: 'Belice',
  Tulum: 'Tulum',
  BocasDelToro: 'Bocas del Toro',
};

/** API enum (`Samana`) → display label (`Samaná`). */
export function destinationLabel(destination: Destination): string {
  return DESTINATION_LABELS[destination];
}

/** Display label (`Samaná`) → API enum (`Samana`), for chip selection. */
export function destinationFromLabel(label: string): Destination | undefined {
  const entry = (Object.entries(DESTINATION_LABELS) as [Destination, string][]).find(
    ([, value]) => value === label,
  );
  return entry?.[0];
}

/** All destinations in display order. */
export const DESTINATIONS = Object.keys(DESTINATION_LABELS) as Destination[];

function parseIsoDate(iso: string): Date {
  // Date-only ISO is treated as UTC midnight so the weekday never shifts.
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripDot(value: string): string {
  return value.replace(/\.$/, '');
}
