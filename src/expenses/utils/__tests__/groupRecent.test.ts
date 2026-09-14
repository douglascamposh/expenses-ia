import { ExpenseCategory } from '../../categories/expenseCategories';
import type { Expense } from '../../models/Expense';
import { dayLabel, groupRecent } from '../groupRecent';

function exp(id: string, date: string, amount = 10): Expense {
  return {
    id, amount, currency: 'BOB', category: ExpenseCategory.FOOD, kind: 'EXPENSE',
    description: `Gasto ${id}`, date, paymentMethod: 'CASH',
    createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z`,
  };
}

describe('dayLabel', () => {
  it('hoy/ayer/anteayer en minúsculas y fecha corta después', () => {
    expect(dayLabel('2026-09-12', 'es', '2026-09-12')).toBe('hoy');
    expect(dayLabel('2026-09-11', 'es', '2026-09-12')).toBe('ayer');
    expect(dayLabel('2026-09-10', 'es', '2026-09-12')).toBe('anteayer');
    expect(dayLabel('2026-09-05', 'es', '2026-09-12')).toMatch(/5/);
  });

  it('en inglés usa today/yesterday', () => {
    expect(dayLabel('2026-09-12', 'en', '2026-09-12')).toBe('today');
    expect(dayLabel('2026-09-11', 'en', '2026-09-12')).toBe('yesterday');
  });
});

describe('groupRecent', () => {
  it('agrupa por fecha con totales por moneda', () => {
    const sections = groupRecent(
      [exp('a', '2026-09-12', 100), exp('b', '2026-09-12', 50), exp('c', '2026-09-11', 20)],
      5, 30, '2026-09-12',
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].label).toBe('hoy');
    expect(sections[0].items).toHaveLength(2);
    expect(sections[0].totals.BOB).toBe(150);
    expect(sections[1].label).toBe('ayer');
  });

  it('corta a 5 fechas y 30 items', () => {
    // Tope de items: 10 por fecha x3 fechas = 30
    const many: Expense[] = [];
    for (let d = 12; d >= 10; d--) {
      const date = `2026-09-${String(d).padStart(2, '0')}`;
      for (let i = 0; i < 10; i++) many.push(exp(`${d}-${i}`, date));
    }
    expect(groupRecent(many, 5, 30, '2026-09-12').flatMap((s) => s.items)).toHaveLength(30);
    // Tope de fechas: pocos por fecha en muchas fechas
    const spread: Expense[] = [];
    for (let d = 12; d >= 1; d--) {
      const date = `2026-09-${String(d).padStart(2, '0')}`;
      for (let i = 0; i < 2; i++) spread.push(exp(`${d}-${i}`, date));
    }
    const sections = groupRecent(spread, 5, 30, '2026-09-12');
    expect(sections).toHaveLength(5);
    expect(sections[0].date).toBe('2026-09-12');
  });

  it('ignora nulos y lista vacía', () => {
    expect(groupRecent([])).toEqual([]);
    expect(groupRecent([null as never, exp('a', '2026-09-12')], 5, 30, '2026-09-12')).toHaveLength(1);
  });
});
