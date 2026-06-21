import type { Package } from '@/api/types';
import { describe, expect, it } from 'vitest';
import { buildMonthGroups, totalDepartures } from './monthGroups';

function pkg(id: string, dates: [string, number][]): Package {
  return {
    id,
    title: id,
    destination: 'Samana',
    heroImage: '',
    gallery: [],
    shortPitch: '',
    descriptionMd: '',
    included: [],
    notIncluded: [],
    departures: dates.map(([date, price]) => ({ date, price })),
    priceFrom: Math.min(...dates.map(([, p]) => p)),
    featured: false,
  };
}

describe('buildMonthGroups', () => {
  it('groups by month, months chronological, days ascending', () => {
    const groups = buildMonthGroups([
      pkg('a', [
        ['2026-07-12', 100],
        ['2026-06-14', 100],
      ]),
      pkg('b', [['2026-06-20', 100]]),
      pkg('c', [['2026-08-02', 100]]),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(groups.map((g) => g.label)).toEqual(['Junio 2026', 'Julio 2026', 'Agosto 2026']);
    // June: 14 (a) before 20 (b).
    expect(groups[0].items.map((i) => i.departure.date)).toEqual(['2026-06-14', '2026-06-20']);
  });

  it('places a multi-departure package in each of its months', () => {
    const groups = buildMonthGroups([
      pkg('a', [
        ['2026-06-14', 100],
        ['2026-07-12', 200],
      ]),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items[0].pkg.id).toBe('a');
    expect(groups[0].items[0].departure.price).toBe(100);
    expect(groups[1].items[0].departure.price).toBe(200);
    expect(totalDepartures(groups)).toBe(2);
  });

  it('handles no packages', () => {
    expect(buildMonthGroups([])).toEqual([]);
    expect(totalDepartures([])).toBe(0);
  });
});
