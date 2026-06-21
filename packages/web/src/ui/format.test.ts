import { describe, expect, it } from 'vitest';
import {
  destinationFromLabel,
  destinationLabel,
  formatDateShort,
  formatMonth,
  formatRD,
  monthKey,
} from './format';

describe('formatRD', () => {
  it('prefixes RD$ and groups thousands with commas', () => {
    expect(formatRD(24900)).toBe('RD$24,900');
    expect(formatRD(154000)).toBe('RD$154,000');
    expect(formatRD(9800)).toBe('RD$9,800');
    expect(formatRD(0)).toBe('RD$0');
  });
});

describe('formatDateShort', () => {
  it('renders the real calendar weekday, day, short month, year', () => {
    // 2026-06-14 is a Sunday — the briefs printed "Sáb" but that mock weekday
    // is not calendar-accurate; the formatter derives the true weekday.
    expect(formatDateShort('2026-06-14')).toBe('Dom 14 jun 2026');
    expect(formatDateShort('2026-08-09')).toBe('Dom 9 ago 2026');
    expect(formatDateShort('2026-07-05')).toBe('Dom 5 jul 2026');
  });

  it('does not shift across timezones (UTC date-only)', () => {
    expect(formatDateShort('2026-01-01')).toBe('Jue 1 ene 2026');
  });
});

describe('formatMonth', () => {
  it('renders a capitalized Spanish month and year', () => {
    expect(formatMonth('2026-06-14')).toBe('Junio 2026');
    expect(formatMonth('2026-07-01')).toBe('Julio 2026');
    expect(formatMonth('2026-08-31')).toBe('Agosto 2026');
  });
});

describe('monthKey', () => {
  it('returns a sortable YYYY-MM key', () => {
    expect(monthKey('2026-06-14')).toBe('2026-06');
  });
});

describe('destination labels', () => {
  it('maps enum to display string and back', () => {
    expect(destinationLabel('Samana')).toBe('Samaná');
    expect(destinationLabel('PuntaCana')).toBe('Punta Cana');
    expect(destinationFromLabel('Bayahíbe')).toBe('Bayahibe');
    expect(destinationFromLabel('La Romana')).toBe('LaRomana');
    expect(destinationFromLabel('Nowhere')).toBeUndefined();
  });
});
