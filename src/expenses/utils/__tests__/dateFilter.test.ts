import { inDateFilter, toISODate } from '../dateFilter';

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

describe('inDateFilter', () => {
  it('all siempre pasa', () => {
    expect(inDateFilter('2020-01-01', 'all')).toBe(true);
  });

  it('today solo el día actual', () => {
    expect(inDateFilter(isoDaysAgo(0), 'today')).toBe(true);
    expect(inDateFilter(isoDaysAgo(1), 'today')).toBe(false);
  });

  it('week cubre los últimos 7 días', () => {
    expect(inDateFilter(isoDaysAgo(0), 'week')).toBe(true);
    expect(inDateFilter(isoDaysAgo(6), 'week')).toBe(true);
    expect(inDateFilter(isoDaysAgo(7), 'week')).toBe(false);
  });

  it('month cubre el mes calendario', () => {
    const today = toISODate(new Date());
    expect(inDateFilter(today, 'month')).toBe(true);
    expect(inDateFilter('2020-01-15', 'month')).toBe(today.slice(0, 7) === '2020-01');
  });
});
