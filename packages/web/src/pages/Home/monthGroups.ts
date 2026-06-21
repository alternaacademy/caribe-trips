import type { Package } from '@/api/types';
import { formatMonth, monthKey } from '@/ui';

export interface DepartureEntry {
  pkg: Package;
  departure: { date: string; price: number };
}

export interface MonthGroup {
  monthKey: string;
  label: string;
  items: DepartureEntry[];
}

/** Flatten packages into (package × departure) entries, grouped by month,
 *  months chronological, days ascending within a month. A package with several
 *  departures appears in several groups. */
export function buildMonthGroups(packages: Package[]): MonthGroup[] {
  const byMonth = new Map<string, DepartureEntry[]>();
  for (const pkg of packages) {
    for (const departure of pkg.departures) {
      const key = monthKey(departure.date);
      const entries = byMonth.get(key) ?? [];
      entries.push({ pkg, departure });
      byMonth.set(key, entries);
    }
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      monthKey: key,
      label: formatMonth(`${key}-01`),
      items: items.sort((a, b) => a.departure.date.localeCompare(b.departure.date)),
    }));
}

/** Total departures across all groups. */
export function totalDepartures(groups: MonthGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}
