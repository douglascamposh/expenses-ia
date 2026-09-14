import { parseAnalyticsQuery, resolveScopeRange, scopeLabel } from '../queryIntent';

describe('parseAnalyticsQuery', () => {
  it('total este mes por defecto (pregunta 1 del usuario)', () => {
    const r = parseAnalyticsQuery('cuánto gasté en total este mes');
    expect(r).toMatchObject({ metric: 'total', category: null, keywords: [], scope: { kind: 'month' } });
  });

  it('máximo este mes (pregunta 2 del usuario)', () => {
    const r = parseAnalyticsQuery('cuál fue mi gasto más fuerte este mes');
    expect(r).toMatchObject({ metric: 'max', category: null, keywords: [] });
    expect(r?.scope.kind).toBe('month');
  });

  it('total en el cine → ENTERTAINMENT', () => {
    const r = parseAnalyticsQuery('cuánto gasté en el cine');
    expect(r).toMatchObject({ metric: 'total', category: 'ENTERTAINMENT', keywords: [] });
  });

  it('total en comida → FOOD sin keywords residuales', () => {
    const r = parseAnalyticsQuery('cuánto dinero he gastado en comida');
    expect(r).toMatchObject({ metric: 'total', category: 'FOOD', keywords: [] });
  });

  it('total últimos tres meses con keywords de descripción', () => {
    const r = parseAnalyticsQuery('cuánto dinero he gastado estos tres meses en alimento para el gato');
    expect(r?.metric).toBe('total');
    expect(r?.category).toBeNull();
    expect(r?.scope).toEqual({ kind: 'lastMonths', n: 3 });
    expect(r?.keywords).toEqual(expect.arrayContaining(['alimento', 'gato']));
    expect(r?.keywords).not.toContain('tres');
    expect(r?.keywords).not.toContain('meses');
  });

  it('inglés: how much + biggest', () => {
    expect(parseAnalyticsQuery('how much did I spend on food')?.metric).toBe('total');
    expect(parseAnalyticsQuery('how much did I spend on food')?.category).toBe('FOOD');
    expect(parseAnalyticsQuery('what was my biggest expense this month')?.metric).toBe('max');
  });

  it('hoy / esta semana / este año', () => {
    expect(parseAnalyticsQuery('cuánto gasté hoy')?.scope.kind).toBe('today');
    expect(parseAnalyticsQuery('cuánto gasté esta semana')?.scope.kind).toBe('week');
    expect(parseAnalyticsQuery('cuánto gasté este año')?.scope.kind).toBe('year');
  });

  it('los números del alcance no quedan como keywords', () => {
    const r = parseAnalyticsQuery('cuánto gasté en total los últimos 12 meses');
    expect(r?.scope).toEqual({ kind: 'lastMonths', n: 12 });
    expect(r?.keywords).toEqual([]);
  });

  it('no analítica → null (usa semántico)', () => {
    expect(parseAnalyticsQuery('almuerzo')).toBeNull();
    expect(parseAnalyticsQuery('comida')).toBeNull();
    expect(parseAnalyticsQuery('')).toBeNull();
  });
});

describe('resolveScopeRange', () => {
  const now = new Date(2026, 8, 10); // 10 sep 2026
  it('month = mes calendario', () => {
    expect(resolveScopeRange({ kind: 'month' }, now)).toEqual({ from: '2026-09-01', to: '2026-09-10' });
  });
  it('month con fecha de reinicio (gancho configurable)', () => {
    // Día 15: período vigente 15 ago → hoy
    expect(resolveScopeRange({ kind: 'month' }, now, 15)).toEqual({ from: '2026-08-15', to: '2026-09-10' });
    // Día 5: período vigente 5 sep → hoy
    expect(resolveScopeRange({ kind: 'month' }, now, 5)).toEqual({ from: '2026-09-05', to: '2026-09-10' });
  });
  it('today/week/year/lastMonths', () => {
    expect(resolveScopeRange({ kind: 'today' }, now)).toEqual({ from: '2026-09-10', to: '2026-09-10' });
    expect(resolveScopeRange({ kind: 'week' }, now)).toEqual({ from: '2026-09-04', to: '2026-09-10' });
    expect(resolveScopeRange({ kind: 'year' }, now)).toEqual({ from: '2026-01-01', to: '2026-09-10' });
    expect(resolveScopeRange({ kind: 'lastMonths', n: 3 }, now)).toEqual({ from: '2026-07-01', to: '2026-09-10' });
  });
  it('scopeLabel', () => {
    expect(scopeLabel({ kind: 'month' })).toBe('este mes');
    expect(scopeLabel({ kind: 'lastMonths', n: 3 })).toBe('últimos 3 meses');
  });
});
