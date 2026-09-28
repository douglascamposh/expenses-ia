import { formatMonthRange, todayLocalISO } from '../format';

describe('todayLocalISO (hora del sistema, no UTC)', () => {
  it('devuelve YYYY-MM-DD con los componentes locales', () => {
    const d = new Date(2026, 8, 19, 22, 30, 0);
    expect(todayLocalISO(d)).toBe('2026-09-19');
  });

  it('de noche en Bolivia no salta al día siguiente UTC', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'America/La_Paz';
    try {
      // 2026-09-20 02:30 UTC = 2026-09-19 22:30 en La Paz
      const atNight = new Date('2026-09-20T02:30:00.000Z');
      expect(atNight.toISOString().split('T')[0]).toBe('2026-09-20'); // lo que hacía el bug
      expect(todayLocalISO(atNight)).toBe('2026-09-19'); // lo correcto en el sistema
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });

  it('formatMonthRange respeta el mes local', () => {
    expect(formatMonthRange(new Date(2026, 8, 15, 12, 0, 0))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});
