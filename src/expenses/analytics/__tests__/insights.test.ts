import { ExpenseCategory } from '../../categories/expenseCategories';
import type { Expense } from '../../models/Expense';
import {
  detectHormiga,
  monthReview,
  routeAiQuery,
  savingAdvice,
  topSpending,
} from '../insights';

function exp(partial: Partial<Expense> & { id: string }): Expense {
  return {
    amount: 10,
    currency: 'BOB',
    category: ExpenseCategory.FOOD,
    kind: 'EXPENSE',
    description: 'Gasto',
    date: '2026-09-10',
    paymentMethod: 'CASH',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
    ...partial,
  } as Expense;
}

describe('detectHormiga', () => {
  it('agrupa chicos repetidos e ignora grandes y únicos', () => {
    const list = [
      exp({ id: 'a1', description: 'Café', amount: 12 }),
      exp({ id: 'a2', description: 'café', amount: 15 }),
      exp({ id: 'a3', description: 'Café', amount: 10 }),
      exp({ id: 'b1', description: 'Cine', amount: 200 }),
      exp({ id: 'c1', description: 'Helado', amount: 20 }),
      exp({ id: 'd1', description: 'Sueldo', amount: 3000, kind: 'INCOME' }),
    ];
    const r = detectHormiga(list, 'BOB');
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].label).toBe('Café');
    expect(r.groups[0].count).toBe(3);
    expect(r.groups[0].total).toBe(37);
    expect(r.total).toBe(37);
  });

  it('sin repetidos no hay hormiga', () => {
    const r = detectHormiga([exp({ id: 'a', amount: 5 })], 'BOB');
    expect(r.groups).toHaveLength(0);
    expect(r.total).toBe(0);
  });
});

describe('topSpending', () => {
  it('devuelve la categoría dominante con participación', () => {
    const list = [
      exp({ id: 'a', category: ExpenseCategory.FOOD, amount: 700 }),
      exp({ id: 'b', category: ExpenseCategory.TRANSPORT, amount: 300 }),
    ];
    const top = topSpending(list, 'BOB');
    expect(top?.category).toBe('FOOD');
    expect(top?.share).toBeCloseTo(70, 5);
  });

  it('sin gastos retorna null', () => {
    expect(topSpending([], 'BOB')).toBeNull();
  });
});

describe('monthReview', () => {
  it('total, top y delta vs mes anterior', () => {
    const cur = [exp({ id: 'a', amount: 600 }), exp({ id: 'b', amount: 400 })];
    const prev = [exp({ id: 'c', amount: 500 })];
    const r = monthReview(cur, prev, 'BOB');
    expect(r.total).toBe(1000);
    expect(r.count).toBe(2);
    expect(r.deltaPct).toBeCloseTo(100, 5);
    expect(r.top?.total).toBe(1000);
  });
});

describe('savingAdvice', () => {
  it('incluye suscripción recurrente y hormiga ordenados por ahorro', () => {
    const list = [
      exp({ id: 'a1', description: 'Café', amount: 12 }),
      exp({ id: 'a2', description: 'Café', amount: 12 }),
      exp({ id: 'a3', description: 'Café', amount: 12 }),
    ];
    const r = savingAdvice({
      expenses: list,
      rules: [{
        id: 'r1', description: 'Netflix', amount: 55, currency: 'BOB', category: ExpenseCategory.OTHER,
        kind: 'EXPENSE', frequency: 'MONTHLY', day1: 1, day2: null, weekday: null, month: null,
        paymentMethod: 'CASH', startDate: '2026-01-01', endDate: null, active: true,
        lastGenerated: null, createdAt: '', updatedAt: '',
      }],
      budgets: [],
      currency: 'BOB',
      lang: 'es',
    });
    const kinds = r.suggestions.map((s) => s.kind);
    expect(kinds).toContain('subscription');
    expect(kinds).toContain('hormiga');
    expect(r.total).toBeGreaterThan(0);
    // Ordenados por estimado descendente
    const est = r.suggestions.map((s) => s.estimated);
    expect([...est].sort((a, b) => b - a)).toEqual(est);
  });
});

describe('routeAiQuery', () => {
  it('clasifica intents sin tildes ni mayúsculas', () => {
    expect(routeAiQuery('GASTOS HORMIGA')).toBe('hormiga');
    expect(routeAiQuery('revisión del mes')).toBe('review');
    expect(routeAiQuery('¿cómo ahorrar más?')).toBe('save');
    expect(routeAiQuery('dónde gasto más')).toBe('top');
  });

  it('no clasifica consultas de totales (van a analytics)', () => {
    expect(routeAiQuery('cuánto gasté en café este mes')).toBeNull();
    expect(routeAiQuery('')).toBeNull();
  });
});
